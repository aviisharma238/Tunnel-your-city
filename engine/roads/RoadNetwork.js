/**
 * RoadNetwork.js — Logical graph managing nodes, road segments, intersections,
 * snapping, road splitting, roundabouts, and undo/redo history.
 */

import * as THREE from 'three';
import { ROAD_TYPES } from './RoadTypes.js';
import { BezierCurve3D, createBezierFromPoints } from './RoadGeometry.js';
import { Intersection } from './Intersection.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

let nextNodeId = 1;
let nextRoadId = 1;

export class RoadNetwork {
  constructor(laneSystem) {
    this.laneSystem = laneSystem;
    this.nodes = new Map();         // nodeId -> Node
    this.roads = new Map();         // roadId -> Road
    this.intersections = new Map(); // nodeId -> Intersection

    // Undo / Redo history stacks
    this._history = [];
    this._redoStack = [];
    this._isPerformingHistoryAction = false;
  }

  /**
   * Find snap target near worldPoint.
   * Priority 1: Existing Node
   * Priority 2: Existing Road curve (for T-intersections)
   */
  findSnapTarget(worldPoint, snapRadius = 8.0) {
    let closestNode = null;
    let minNodeDist = snapRadius;

    // 1. Check existing nodes
    for (const node of this.nodes.values()) {
      const dist = new THREE.Vector2(node.position.x, node.position.z).distanceTo(
        new THREE.Vector2(worldPoint.x, worldPoint.z)
      );
      if (dist < minNodeDist) {
        minNodeDist = dist;
        closestNode = node;
      }
    }

    if (closestNode) {
      return {
        type: 'node',
        node: closestNode,
        point: closestNode.position.clone(),
        elevation: closestNode.elevation,
      };
    }

    // 2. Check existing road curves for edge snapping (creating T-intersections)
    let closestRoad = null;
    let closestT = 0;
    let minRoadDist = snapRadius * 0.85;
    let snapPoint = null;

    for (const road of this.roads.values()) {
      const curve = road.curve;
      const numSamples = Math.max(10, Math.ceil(curve.length / 3.0));
      for (let s = 1; s < numSamples; s++) {
        const t = s / numSamples;
        const pt = curve.getPoint(t);
        const dist = new THREE.Vector2(pt.x, pt.z).distanceTo(
          new THREE.Vector2(worldPoint.x, worldPoint.z)
        );
        if (dist < minRoadDist) {
          minRoadDist = dist;
          closestRoad = road;
          closestT = t;
          snapPoint = pt;
        }
      }
    }

    if (closestRoad && snapPoint) {
      return {
        type: 'road',
        road: closestRoad,
        t: closestT,
        point: snapPoint.clone(),
        elevation: snapPoint.y,
      };
    }

    return null;
  }

  /**
   * Get or create a node at a given position.
   */
  getOrCreateNode(position, elevation = 0, snapRadius = 3.0) {
    for (const node of this.nodes.values()) {
      const dist = new THREE.Vector2(node.position.x, node.position.z).distanceTo(
        new THREE.Vector2(position.x, position.z)
      );
      if (dist < snapRadius && Math.abs(node.elevation - elevation) < 1.0) {
        return node;
      }
    }

    const id = `node_${nextNodeId++}`;
    const node = {
      id,
      position: position.clone(),
      elevation: elevation,
      connectedRoadIds: new Set(),
    };
    node.position.y = elevation;
    this.nodes.set(id, node);
    return node;
  }

  /**
   * Add a new road segment between two points.
   * Handles Bézier control points, snapping to nodes or road splits.
   */
  addRoad(p0, p3, roadTypeKey = 'LOCAL', options = {}) {
    const roadType = typeof roadTypeKey === 'string' ? ROAD_TYPES[roadTypeKey] || ROAD_TYPES.LOCAL : roadTypeKey;
    const elevationStart = options.elevationStart ?? p0.y;
    const elevationEnd = options.elevationEnd ?? p3.y;

    // Handle snapping or create nodes
    let startNode = options.startNode;
    let endNode = options.endNode;

    if (!startNode) {
      startNode = this.getOrCreateNode(p0, elevationStart);
    }
    if (!endNode) {
      endNode = this.getOrCreateNode(p3, elevationEnd);
    }

    if (startNode.id === endNode.id) {
      console.warn('[RoadNetwork] Cannot connect node to itself.');
      return null;
    }

    // Build Bézier curve
    let curve;
    if (options.curve) {
      curve = options.curve;
    } else {
      const dir0 = options.dir0 || null;
      const dir3 = options.dir3 || null;
      curve = createBezierFromPoints(startNode.position, endNode.position, dir0, dir3, options.curvature || 0.5);
    }

    const roadId = `road_${nextRoadId++}`;
    const road = {
      id: roadId,
      type: roadType,
      startNodeId: startNode.id,
      endNodeId: endNode.id,
      curve,
      elevationStart,
      elevationEnd,
      length: curve.length,
    };

    this.roads.set(roadId, road);
    startNode.connectedRoadIds.add(roadId);
    endNode.connectedRoadIds.add(roadId);

    // Generate lane waypoints
    if (this.laneSystem) {
      this.laneSystem.generateLanesForRoad(road);
    }

    // Update intersections at both ends
    this._updateIntersection(startNode.id);
    this._updateIntersection(endNode.id);

    // Save to history for undo
    if (!this._isPerformingHistoryAction) {
      this._history.push({
        action: 'ADD_ROAD',
        roadId,
        roadData: { ...road },
      });
      this._redoStack = [];
    }

    eventBus.emit(EVENTS.ROAD_ADDED, road);
    return road;
  }

  /**
   * Split a road into two segments at parameter t and create a junction node.
   */
  splitRoad(roadId, splitPoint, t) {
    const road = this.roads.get(roadId);
    if (!road) return null;

    const oldStartNode = this.nodes.get(road.startNodeId);
    const oldEndNode = this.nodes.get(road.endNodeId);
    const roadType = road.type;

    // Create intermediate junction node
    const junctionNode = this.getOrCreateNode(splitPoint, splitPoint.y);

    // Remove the original road
    this.removeRoad(roadId, false);

    // Add 2 new segments
    const road1 = this.addRoad(oldStartNode.position, junctionNode.position, roadType, {
      startNode: oldStartNode,
      endNode: junctionNode,
      elevationStart: road.elevationStart,
      elevationEnd: splitPoint.y,
    });

    const road2 = this.addRoad(junctionNode.position, oldEndNode.position, roadType, {
      startNode: junctionNode,
      endNode: oldEndNode,
      elevationStart: splitPoint.y,
      elevationEnd: road.elevationEnd,
    });

    return { junctionNode, road1, road2 };
  }

  /**
   * Remove a road segment and clean up orphaned nodes/intersections.
   */
  removeRoad(roadId, recordHistory = true) {
    const road = this.roads.get(roadId);
    if (!road) return false;

    if (recordHistory && !this._isPerformingHistoryAction) {
      this._history.push({
        action: 'REMOVE_ROAD',
        roadId,
        roadData: { ...road },
      });
      this._redoStack = [];
    }

    const startNode = this.nodes.get(road.startNodeId);
    const endNode = this.nodes.get(road.endNodeId);

    if (startNode) startNode.connectedRoadIds.delete(roadId);
    if (endNode) endNode.connectedRoadIds.delete(roadId);

    this.roads.delete(roadId);
    if (this.laneSystem) {
      this.laneSystem.removeLanesForRoad(roadId);
    }

    // Update or remove intersections
    if (startNode) {
      if (startNode.connectedRoadIds.size === 0) {
        this.nodes.delete(startNode.id);
        this.intersections.delete(startNode.id);
      } else {
        this._updateIntersection(startNode.id);
      }
    }

    if (endNode) {
      if (endNode.connectedRoadIds.size === 0) {
        this.nodes.delete(endNode.id);
        this.intersections.delete(endNode.id);
      } else {
        this._updateIntersection(endNode.id);
      }
    }

    eventBus.emit(EVENTS.ROAD_REMOVED, roadId);
    return true;
  }

  /**
   * Create a 4-way Roundabout preset at center.
   */
  createRoundabout(center, radius = 22) {
    const centerNode = this.getOrCreateNode(center, 0);
    const roundaboutInt = new Intersection(centerNode.id, center);
    roundaboutInt.radius = radius;
    roundaboutInt.isRoundabout = true;
    this.intersections.set(centerNode.id, roundaboutInt);

    // Create 4 connection stub nodes at North, East, South, West
    const stubs = [];
    const offsets = [
      new THREE.Vector3(0, 0, -radius - 8), // North
      new THREE.Vector3(radius + 8, 0, 0),  // East
      new THREE.Vector3(0, 0, radius + 8),  // South
      new THREE.Vector3(-radius - 8, 0, 0), // West
    ];

    offsets.forEach(off => {
      const stubPos = center.clone().add(off);
      const stubNode = this.getOrCreateNode(stubPos, 0);
      stubs.push(stubNode);
      // Connect stub to center
      this.addRoad(stubPos, center, ROAD_TYPES.LOCAL, {
        startNode: stubNode,
        endNode: centerNode,
      });
    });

    eventBus.emit(EVENTS.ROAD_UPDATED);
    return { centerNode, stubs, roundaboutInt };
  }

  /**
   * Update intersection logic for a node.
   */
  _updateIntersection(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (node.connectedRoadIds.size >= 2) {
      let intersection = this.intersections.get(nodeId);
      if (!intersection) {
        intersection = new Intersection(nodeId, node.position);
        this.intersections.set(nodeId, intersection);
      }

      const connectedRoadData = [];
      node.connectedRoadIds.forEach(rId => {
        const road = this.roads.get(rId);
        if (!road) return;
        const isStart = road.startNodeId === nodeId;
        const tangent = isStart ? road.curve.getTangent(0) : road.curve.getTangent(1).negate();
        const angle = Math.atan2(tangent.z, tangent.x);

        connectedRoadData.push({
          roadId: rId,
          angle,
          width: road.type.totalWidth,
          isStart,
        });
      });

      intersection.updateConnections(connectedRoadData);

      if (this.laneSystem) {
        this.laneSystem.connectIntersectionLanes(intersection, connectedRoadData);
      }
    } else {
      this.intersections.delete(nodeId);
    }
  }

  undo() {
    if (this._history.length === 0) return false;
    const item = this._history.pop();
    this._isPerformingHistoryAction = true;

    if (item.action === 'ADD_ROAD') {
      this.removeRoad(item.roadId, false);
      this._redoStack.push(item);
    } else if (item.action === 'REMOVE_ROAD') {
      const d = item.roadData;
      this.addRoad(d.curve.p0, d.curve.p3, d.type, {
        curve: d.curve,
        elevationStart: d.elevationStart,
        elevationEnd: d.elevationEnd,
      });
      this._redoStack.push(item);
    }

    this._isPerformingHistoryAction = false;
    eventBus.emit(EVENTS.ROAD_UPDATED);
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;
    const item = this._redoStack.pop();
    this._isPerformingHistoryAction = true;

    if (item.action === 'ADD_ROAD') {
      const d = item.roadData;
      this.addRoad(d.curve.p0, d.curve.p3, d.type, {
        curve: d.curve,
        elevationStart: d.elevationStart,
        elevationEnd: d.elevationEnd,
      });
      this._history.push(item);
    } else if (item.action === 'REMOVE_ROAD') {
      this.removeRoad(item.roadId, false);
      this._history.push(item);
    }

    this._isPerformingHistoryAction = false;
    eventBus.emit(EVENTS.ROAD_UPDATED);
    return true;
  }

  clear() {
    this.roads.clear();
    this.nodes.clear();
    this.intersections.clear();
    this._history = [];
    this._redoStack = [];
    if (this.laneSystem) this.laneSystem.clear();
    eventBus.emit(EVENTS.ROAD_UPDATED);
  }
}

