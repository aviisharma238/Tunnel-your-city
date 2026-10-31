/**
 * RoadBuilder.js — Interactive player tool for drawing, curving, snapping,
 * and demolishing roads, bridges, and roundabouts in real-time.
 */

import * as THREE from 'three';
import { ROAD_TYPES, ELEVATION_LEVELS } from './RoadTypes.js';
import { createBezierFromPoints } from './RoadGeometry.js';
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

    // Undo / Redo bound
    this._bindEvents();

    // Listen to store/eventbus changes
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
    this.active = tool === 'road' || tool === 'demolish';
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

  toggleElevation() {
    const nextElev = this.currentElevation === 0 ? ELEVATION_LEVELS.BRIDGE : 0;
    this.setElevation(nextElev);
    return nextElev;
  }

  _bindEvents() {
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerdown', this._onPointerDown);
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

  _onPointerMove(e) {
    if (!this.active) return;
    const worldPos = this._getWorldRaycast(e);
    if (!worldPos) return;

    if (this.activeTool === 'demolish') {
      this._handleDemolishHover(worldPos);
      return;
    }

    if (this.activeTool === 'road') {
      // Check snapping
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
          // Smooth curved Bézier
          curve = createBezierFromPoints(this.startPoint, targetPos, null, null, 0.5);
        }
        this.currentCurve = curve;
        this.roadRenderer.setPreview(curve, roadType);
      }
    }
  }

  _onPointerDown(e) {
    if (!this.active || e.button !== 0) return; // Left click only
    const worldPos = this._getWorldRaycast(e);
    if (!worldPos) return;

    if (this.activeTool === 'demolish') {
      this._handleDemolishClick(worldPos);
      return;
    }

    if (this.activeTool === 'road') {
      const roadType = ROAD_TYPES[this.roadTypeKey] || ROAD_TYPES.LOCAL;

      // Handle Roundabout placement tool
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
        // First click: start drawing road
        this.isDrawing = true;
        this.startPoint = clickPos;
        this.startSnap = snap;
      } else {
        // Second click: finalize road
        if (this.startPoint.distanceTo(clickPos) < 5.0) {
          // Too short
          return;
        }

        // If end point snapped to a road curve (split it into T-intersection)
        let endNode = null;
        if (snap && snap.type === 'road') {
          const splitResult = this.roadNetwork.splitRoad(snap.road.id, snap.point, snap.t);
          if (splitResult) {
            endNode = splitResult.junctionNode;
            clickPos = endNode.position.clone();
          }
        }

        // If start point snapped to a road curve
        let startNode = null;
        if (this.startSnap && this.startSnap.type === 'road') {
          const splitResult = this.roadNetwork.splitRoad(this.startSnap.road.id, this.startSnap.point, this.startSnap.t);
          if (splitResult) {
            startNode = splitResult.junctionNode;
            this.startPoint = startNode.position.clone();
          }
        }

        // Add the road to logical network
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

        // If Shift is held down, continue chaining from clickPos
        if (e.shiftKey) {
          this.startPoint = clickPos;
          this.startSnap = this.roadNetwork.findSnapTarget(clickPos, 4.0);
        } else {
          this.cancelDrawing();
        }
      }
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
      // Toggle elevation between Ground and Bridge
      const elev = this.toggleElevation();
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
    this.roadRenderer.clearPreview();
    this.roadRenderer.setSnapIndicator(null, false);
    if (this.hoveredRoadId) {
      this.roadRenderer.setDemolishHighlight(this.hoveredRoadId, false);
      this.hoveredRoadId = null;
    }
  }

  _rebuildAllMeshes() {
    // Clear and redraw all roads and intersections
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
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}

