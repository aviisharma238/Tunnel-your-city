/**
 * RoadBuilder.js — Interactive player tool for drawing, curving, snapping,
 * reshaping via control points, and demolishing roads, bridges, and roundabouts.
 * Replicates the fluid spline manipulation from Trafficity.
 */

import * as THREE from 'three';
import { ROAD_TYPES, ELEVATION_LEVELS } from './RoadTypes.js';
import { createBezierFromPoints, BezierCurve3D } from './RoadGeometry.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

export const BUILD_MODES = {
  CURVED: 'curved',
  STRAIGHT: 'straight',
  ROUNDABOUT: 'roundabout',
};

export class RoadBuilder {
  /**
   * @param {import('./RoadNetwork').RoadNetwork} roadNetwork
   * @param {import('./RoadRenderer').RoadRenderer} roadRenderer
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement
   */
  constructor(roadNetwork, roadRenderer, camera, domElement) {
    this.roadNetwork = roadNetwork;
    this.roadRenderer = roadRenderer;
    this.camera = camera;
    this.domElement = domElement;

    this.active = false;
    this.activeTool = 'road'; // 'road' | 'demolish' | 'select'
    this.roadTypeKey = 'LOCAL';
    this.buildMode = BUILD_MODES.CURVED;
    this.currentElevation = ELEVATION_LEVELS.GROUND;

    // Raycasting plane
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Drawing state
    this.isDrawing = false;
    this.startPoint = null;
    this.startSnap = null;
    this.currentCurve = null;
    this.hoverSnap = null;
    this.hoveredRoadId = null;

    // Handle dragging state (for dragging black control point dots)
    this.hoveredHandle = null;  // { road, handleKey: 'p0'|'p1'|'p2'|'p3' }
    this.isDraggingHandle = false;

    this._bindEvents();

    eventBus.on(EVENTS.ROAD_ADDED, (road) => {
      this.roadRenderer.updateRoad(road);
    });
    eventBus.on(EVENTS.ROAD_REMOVED, (roadId) => {
      this.roadRenderer.removeRoad(roadId);
    });
    eventBus.on(EVENTS.ROAD_UPDATED, () => {
      this._rebuildAllMeshes();
    });
  }

  setTool(tool) {
    this.cancelDrawing();
    this.activeTool = tool;
    this.active = tool === 'road' || tool === 'demolish' || tool === 'select';
  }

  setRoadType(typeKey) {
    this.roadTypeKey = typeKey;
  }

  setBuildMode(mode) {
    this.buildMode = mode;
  }

  setElevation(elev) {
    this.currentElevation = elev;
    this._groundPlane.constant = -elev;
  }

  cycleElevation() {
    let nextElev = 0;
    if (this.currentElevation === 0) nextElev = ELEVATION_LEVELS.BRIDGE;
    else if (this.currentElevation === ELEVATION_LEVELS.BRIDGE) nextElev = ELEVATION_LEVELS.HIGH_BRIDGE;
    else nextElev = 0;

    this.setElevation(nextElev);
    return nextElev;
  }

  _bindEvents() {
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.domElement.addEventListener('pointerup', this._onPointerUp);
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
  }

  _getWorldRaycast(e) {
    const rect = this.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    const target = new THREE.Vector3();
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, target);

    return hit ? target : null;
  }

  _findNearHandle(worldPos, radius = 5.0) {
    for (const road of this.roadNetwork.roads.values()) {
      const handles = [
        { key: 'p0', pos: road.curve.p0 },
        { key: 'p1', pos: road.curve.p1 },
        { key: 'p2', pos: road.curve.p2 },
        { key: 'p3', pos: road.curve.p3 },
      ];

      for (const h of handles) {
        if (new THREE.Vector2(h.pos.x, h.pos.z).distanceTo(new THREE.Vector2(worldPos.x, worldPos.z)) < radius) {
          return { road, handleKey: h.key, position: h.pos };
        }
      }
    }
    return null;
  }

  _onPointerMove(e) {
    if (!this.active) return;
    const worldPos = this._getWorldRaycast(e);
    if (!worldPos) return;

    // Handle interactive black dot dragging
    if (this.isDraggingHandle && this.hoveredHandle) {
      const { road, handleKey } = this.hoveredHandle;
      const c = road.curve;

      if (handleKey === 'p0') {
        c.p0.x = worldPos.x; c.p0.z = worldPos.z;
        const node = this.roadNetwork.nodes.get(road.startNodeId);
        if (node) { node.position.x = worldPos.x; node.position.z = worldPos.z; }
      } else if (handleKey === 'p1') {
        c.p1.x = worldPos.x; c.p1.z = worldPos.z;
      } else if (handleKey === 'p2') {
        c.p2.x = worldPos.x; c.p2.z = worldPos.z;
      } else if (handleKey === 'p3') {
        c.p3.x = worldPos.x; c.p3.z = worldPos.z;
        const node = this.roadNetwork.nodes.get(road.endNodeId);
        if (node) { node.position.x = worldPos.x; node.position.z = worldPos.z; }
      }

      // Rebuild road with updated curve
      road.curve = new BezierCurve3D(c.p0, c.p1, c.p2, c.p3);
      road.length = road.curve.length;
      this.roadRenderer.updateRoad(road);
      if (this.roadNetwork.laneSystem) {
        this.roadNetwork.laneSystem.generateLanesForRoad(road);
      }
      return;
    }

    if (this.activeTool === 'demolish') {
      this._handleDemolishHover(worldPos);
      return;
    }

    // Check if hovering over any black control point handle
    const nearHandle = this._findNearHandle(worldPos, 4.5);
    this.hoveredHandle = nearHandle;

    if (nearHandle) {
      this.domElement.style.cursor = 'grab';
      this.roadRenderer.setSnapIndicator(nearHandle.position, true, 0x0f172a);
      return;
    } else {
      this.domElement.style.cursor = 'default';
    }

    if (this.activeTool === 'road') {
      const snap = this.roadNetwork.findSnapTarget(worldPos, 10.0);
      this.hoverSnap = snap;

      let targetPos = worldPos;
      if (snap) {
        targetPos = snap.point.clone();
        this.roadRenderer.setSnapIndicator(targetPos, true, snap.type === 'node' ? 0x38bdf8 : 0xf59e0b);
      } else {
        this.roadRenderer.setSnapIndicator(null, false);
      }

      if (this.isDrawing && this.startPoint) {
        const roadType = ROAD_TYPES[this.roadTypeKey] || ROAD_TYPES.LOCAL;

        let curve;
        if (this.buildMode === BUILD_MODES.STRAIGHT) {
          curve = createBezierFromPoints(this.startPoint, targetPos, null, null, 0.0);
        } else {
          // Tangent continuity from start node
          let dir0 = null;
          if (this.startSnap?.node?.connectedRoadIds?.size > 0) {
            const firstRoadId = Array.from(this.startSnap.node.connectedRoadIds)[0];
            const r = this.roadNetwork.roads.get(firstRoadId);
            if (r) {
              const isStart = r.startNodeId === this.startSnap.node.id;
              dir0 = isStart ? r.curve.getTangent(0).clone().negate() : r.curve.getTangent(1).clone();
            }
          }

          // Tangent continuity from target snap node
          let dir3 = null;
          if (snap?.node?.connectedRoadIds?.size > 0) {
            const firstRoadId = Array.from(snap.node.connectedRoadIds)[0];
            const r = this.roadNetwork.roads.get(firstRoadId);
            if (r) {
              const isStart = r.startNodeId === snap.node.id;
              dir3 = isStart ? r.curve.getTangent(0).clone() : r.curve.getTangent(1).clone().negate();
            }
          }

          curve = createBezierFromPoints(this.startPoint, targetPos, dir0, dir3, 0.65);
        }
        this.currentCurve = curve;
        this.roadRenderer.setPreview(curve, roadType);
      }
    }
  }

  _onPointerDown(e) {
    if (!this.active || e.button !== 0) return;
    const worldPos = this._getWorldRaycast(e);
    if (!worldPos) return;

    // Check if clicking on a control point handle to drag it
    if (this.hoveredHandle && !this.isDrawing) {
      this.isDraggingHandle = true;
      this.domElement.style.cursor = 'grabbing';
      return;
    }

    if (this.activeTool === 'demolish') {
      this._handleDemolishClick(worldPos);
      return;
    }

    if (this.activeTool === 'road') {
      const roadType = ROAD_TYPES[this.roadTypeKey] || ROAD_TYPES.LOCAL;

      if (this.buildMode === BUILD_MODES.ROUNDABOUT) {
        this.roadNetwork.createRoundabout(worldPos, 22);
        this._rebuildAllMeshes();
        return;
      }

      const snap = this.hoverSnap;
      let clickPos = worldPos.clone();
      if (snap) {
        clickPos = snap.point.clone();
      }

      if (!this.isDrawing) {
        this.isDrawing = true;
        this.startPoint = clickPos;
        this.startSnap = snap;
      } else {
        if (this.startPoint.distanceTo(clickPos) < 5.0) return;

        let endNode = null;
        if (snap && snap.type === 'road') {
          const splitResult = this.roadNetwork.splitRoad(snap.road.id, snap.point, snap.t);
          if (splitResult) {
            endNode = splitResult.junctionNode;
            clickPos = endNode.position.clone();
          }
        }

        let startNode = null;
        if (this.startSnap && this.startSnap.type === 'road') {
          const splitResult = this.roadNetwork.splitRoad(this.startSnap.road.id, this.startSnap.point, this.startSnap.t);
          if (splitResult) {
            startNode = splitResult.junctionNode;
            this.startPoint = startNode.position.clone();
          }
        }

        const newRoad = this.roadNetwork.addRoad(this.startPoint, clickPos, this.roadTypeKey, {
          curve: this.currentCurve,
          elevationStart: this.startPoint.y,
          elevationEnd: clickPos.y,
          startNode,
          endNode,
        });

        if (newRoad) {
          this._rebuildAllMeshes();
        }

        if (e.shiftKey) {
          this.startPoint = clickPos;
          this.startSnap = this.roadNetwork.findSnapTarget(clickPos, 4.0);
        } else {
          this.cancelDrawing();
        }
      }
    }
  }

  _onPointerUp(e) {
    if (this.isDraggingHandle) {
      this.isDraggingHandle = false;
      this.domElement.style.cursor = 'default';
      this._rebuildAllMeshes();
      eventBus.emit(EVENTS.ROAD_UPDATED);
    }
  }

  _handleDemolishHover(worldPos) {
    const snap = this.roadNetwork.findSnapTarget(worldPos, 12.0);
    const roadId = snap?.road?.id || null;

    if (this.hoveredRoadId && this.hoveredRoadId !== roadId) {
      this.roadRenderer.setDemolishHighlight(this.hoveredRoadId, false);
    }
    if (roadId) {
      this.roadRenderer.setDemolishHighlight(roadId, true);
    }
    this.hoveredRoadId = roadId;
  }

  _handleDemolishClick(worldPos) {
    if (this.hoveredRoadId) {
      this.roadNetwork.removeRoad(this.hoveredRoadId);
      this.hoveredRoadId = null;
      this._rebuildAllMeshes();
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
    this.cancelDrawing();
  }

  _onKeyDown(e) {
    if (e.code === 'Escape') {
      this.cancelDrawing();
    } else if (e.code === 'KeyE') {
      const elev = this.cycleElevation();
      eventBus.emit('ui:elevationChanged', elev);
    } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        this.roadNetwork.redo();
      } else {
        this.roadNetwork.undo();
      }
    }
  }

  cancelDrawing() {
    this.isDrawing = false;
    this.startPoint = null;
    this.startSnap = null;
    this.currentCurve = null;
    this.isDraggingHandle = false;
    this.roadRenderer.clearPreview();
    this.roadRenderer.setSnapIndicator(null, false);
    if (this.hoveredRoadId) {
      this.roadRenderer.setDemolishHighlight(this.hoveredRoadId, false);
      this.hoveredRoadId = null;
    }
  }

  _rebuildAllMeshes() {
    this.roadNetwork.roads.forEach(road => {
      this.roadRenderer.updateRoad(road);
    });
    this.roadNetwork.intersections.forEach(int => {
      this.roadRenderer.updateIntersection(int);
    });
  }

  dispose() {
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}
