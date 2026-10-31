/**
 * RoadRenderer.js — Visual representation of roads, bridges, intersections,
 * roundabouts, live previews, snap indicators, and control point handles in Three.js.
 * Captures the clean minimalist vector style from Trafficity (image.png).
 */

import * as THREE from 'three';
import { generateRoadMeshes, generateRoundaboutGeometry } from './RoadGeometry.js';

export class RoadRenderer {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;

    this._roadGroup = new THREE.Group();
    this._roadGroup.name = 'road_network_group';
    this._scene.add(this._roadGroup);

    this._intersectionGroup = new THREE.Group();
    this._intersectionGroup.name = 'intersection_group';
    this._scene.add(this._intersectionGroup);

    this._previewGroup = new THREE.Group();
    this._previewGroup.name = 'road_preview_group';
    this._scene.add(this._previewGroup);

    this._handleGroup = new THREE.Group();
    this._handleGroup.name = 'road_handles_group';
    this._scene.add(this._handleGroup);

    this._roadMeshes = new Map();
    this._intersectionMeshes = new Map();

    this._initMaterials();
    this._createSnapIndicator();

    this.showControlPoints = true;
  }

  _initMaterials() {
    // Pure clean white road surface
    this.matSurface = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Dark vector border line (#1f2937)
    this.matBorder = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // Warm amber yellow center line
    this.matCenterLine = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    // Dashed white lane markings
    this.matLaneDivider = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    // Black abutment ticks for bridges
    this.matAbutment = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      side: THREE.DoubleSide,
    });

    // Concrete bridge pillar
    this.matPillar = new THREE.MeshLambertMaterial({
      color: 0x64748b,
    });

    // Preview road material (translucent cyan/white)
    this.matPreview = new THREE.MeshLambertMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    this.matPreviewBorder = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    // Demolish highlight material
    this.matDemolish = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
    });

    // Control point black dot (Trafficity handle style)
    this.matControlPoint = new THREE.MeshBasicMaterial({
      color: 0x0f172a, // pitch dark
    });
    this.matControlPointRim = new THREE.MeshBasicMaterial({
      color: 0xffffff, // crisp white rim
    });

    // Roundabout central island
    this.matIsland = new THREE.MeshLambertMaterial({
      color: 0xede8de, // warm ground match
    });
  }

  _createSnapIndicator() {
    const geo = new THREE.RingGeometry(2.0, 2.8, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this._snapMesh = new THREE.Mesh(geo, mat);
    this._snapMesh.rotation.x = -Math.PI / 2;
    this._snapMesh.position.y = 0.2;
    this._snapMesh.visible = false;
    this._scene.add(this._snapMesh);
  }

  updateRoad(road) {
    this.removeRoad(road.id);

    const {
      roadGeo,
      borderGeo,
      centerLineGeo,
      laneDividerGeo,
      abutmentGeo,
      isBridge,
      pillars,
    } = generateRoadMeshes(road.curve, road.type);

    const group = new THREE.Group();
    group.name = `road_${road.id}`;

    // 1. Surface (pure white)
    const surfMesh = new THREE.Mesh(roadGeo, this.matSurface);
    surfMesh.receiveShadow = true;
    if (isBridge) surfMesh.castShadow = true;
    group.add(surfMesh);

    // 2. Borders
    const borderMesh = new THREE.Mesh(borderGeo, this.matBorder);
    group.add(borderMesh);

    // 3. Center line
    let centerMesh = null;
    if (centerLineGeo) {
      centerMesh = new THREE.Mesh(centerLineGeo, this.matCenterLine);
      group.add(centerMesh);
    }

    // 4. Lane divider dashes
    let dividerMesh = null;
    if (laneDividerGeo) {
      dividerMesh = new THREE.Mesh(laneDividerGeo, this.matLaneDivider);
      group.add(dividerMesh);
    }

    // 5. Bridge abutment black tick marks
    let abutMesh = null;
    if (abutmentGeo) {
      abutMesh = new THREE.Mesh(abutmentGeo, this.matAbutment);
      group.add(abutMesh);
    }

    // 6. Bridge pillars
    const pillarMeshes = [];
    pillars.forEach(p => {
      const pGeo = new THREE.CylinderGeometry(p.width * 0.35, p.width * 0.35, p.height, 12);
      const pMesh = new THREE.Mesh(pGeo, this.matPillar);
      pMesh.position.copy(p.position);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      group.add(pMesh);
      pillarMeshes.push(pMesh);
    });

    this._roadGroup.add(group);
    this._roadMeshes.set(road.id, {
      group,
      surfMesh,
      borderMesh,
      centerMesh,
      dividerMesh,
      abutMesh,
      pillarMeshes,
      road,
    });

    this._updateControlPoints();
  }

  removeRoad(roadId) {
    const entry = this._roadMeshes.get(roadId);
    if (!entry) return;

    this._roadGroup.remove(entry.group);
    entry.surfMesh.geometry.dispose();
    entry.borderMesh.geometry.dispose();
    if (entry.centerMesh) entry.centerMesh.geometry.dispose();
    if (entry.dividerMesh) entry.dividerMesh.geometry.dispose();
    if (entry.abutMesh) entry.abutMesh.geometry.dispose();
    entry.pillarMeshes.forEach(p => p.geometry.dispose());

    this._roadMeshes.delete(roadId);
    this._updateControlPoints();
  }

  updateIntersection(intersection) {
    this.removeIntersection(intersection.id);

    const group = new THREE.Group();
    group.name = intersection.id;

    if (intersection.isRoundabout) {
      const { ringGeo, borderGeo, islandGeo } = generateRoundaboutGeometry(
        intersection.center,
        intersection.radius,
        intersection.radius * 0.58
      );
      const ringMesh = new THREE.Mesh(ringGeo, this.matSurface);
      ringMesh.receiveShadow = true;
      const bMesh = new THREE.Mesh(borderGeo, this.matBorder);
      const islMesh = new THREE.Mesh(islandGeo, this.matIsland);
      islMesh.receiveShadow = true;
      islMesh.castShadow = true;
      group.add(ringMesh, bMesh, islMesh);
    } else {
      const { surfaceGeo, borderGeo } = intersection.generateGeometries();
      const sMesh = new THREE.Mesh(surfaceGeo, this.matSurface);
      sMesh.receiveShadow = true;
      const bMesh = new THREE.Mesh(borderGeo, this.matBorder);
      group.add(sMesh, bMesh);
    }

    this._intersectionGroup.add(group);
    this._intersectionMeshes.set(intersection.id, group);
  }

  removeIntersection(intersectionId) {
    const group = this._intersectionMeshes.get(intersectionId);
    if (!group) return;
    this._intersectionGroup.remove(group);
    group.children.forEach(c => c.geometry?.dispose());
    this._intersectionMeshes.delete(intersectionId);
  }

  setPreview(curve, roadType) {
    this.clearPreview();
    if (!curve) return;

    const { roadGeo, borderGeo } = generateRoadMeshes(curve, roadType);
    const pMesh = new THREE.Mesh(roadGeo, this.matPreview);
    const bMesh = new THREE.Mesh(borderGeo, this.matPreviewBorder);

    this._previewGroup.add(pMesh);
    this._previewGroup.add(bMesh);

    // Show control points for preview curve
    this._drawHandle(curve.p0, 0x0f172a, 1.2);
    this._drawHandle(curve.p1, 0x0284c7, 0.9);
    this._drawHandle(curve.p2, 0x0284c7, 0.9);
    this._drawHandle(curve.p3, 0x0f172a, 1.2);
  }

  clearPreview() {
    while (this._previewGroup.children.length > 0) {
      const child = this._previewGroup.children.pop();
      child.geometry?.dispose();
    }
  }

  setSnapIndicator(position, visible = true, color = 0x38bdf8) {
    if (!this._snapMesh) return;
    this._snapMesh.visible = visible;
    if (visible && position) {
      this._snapMesh.position.set(position.x, position.y + 0.15, position.z);
      this._snapMesh.material.color.setHex(color);
    }
  }

  setDemolishHighlight(roadId, highlight = true) {
    const entry = this._roadMeshes.get(roadId);
    if (!entry) return;
    if (highlight) {
      entry.surfMesh.material = this.matDemolish;
    } else {
      entry.surfMesh.material = this.matSurface;
    }
  }

  _updateControlPoints() {
    while (this._handleGroup.children.length > 0) {
      const child = this._handleGroup.children.pop();
      child.geometry?.dispose();
    }

    if (!this.showControlPoints) return;

    const drawnNodes = new Set();
    for (const entry of this._roadMeshes.values()) {
      const road = entry.road;
      const p0Key = `${Math.round(road.curve.p0.x)},${Math.round(road.curve.p0.z)}`;
      const p3Key = `${Math.round(road.curve.p3.x)},${Math.round(road.curve.p3.z)}`;

      if (!drawnNodes.has(p0Key)) {
        this._drawHandle(road.curve.p0, 0x0f172a, 1.3, this._handleGroup);
        drawnNodes.add(p0Key);
      }
      if (!drawnNodes.has(p3Key)) {
        this._drawHandle(road.curve.p3, 0x0f172a, 1.3, this._handleGroup);
        drawnNodes.add(p3Key);
      }

      // Draw tangent handles on curves as in image.png
      if (road.curve.p1.distanceTo(road.curve.p0) > 4.0) {
        this._drawHandle(road.curve.p1, 0x0f172a, 0.9, this._handleGroup);
        this._drawHandle(road.curve.p2, 0x0f172a, 0.9, this._handleGroup);
      }
    }
  }

  _drawHandle(position, color = 0x0f172a, radius = 1.0, parentGroup = this._previewGroup) {
    const rimGeo = new THREE.CircleGeometry(radius * 1.35, 16);
    const rimMesh = new THREE.Mesh(rimGeo, this.matControlPointRim);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.set(position.x, position.y + 0.2, position.z);

    const dotGeo = new THREE.CircleGeometry(radius, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.rotation.x = -Math.PI / 2;
    dotMesh.position.set(position.x, position.y + 0.22, position.z);

    parentGroup.add(rimMesh);
    parentGroup.add(dotMesh);
  }

  dispose() {
    this._scene.remove(this._roadGroup);
    this._scene.remove(this._intersectionGroup);
    this._scene.remove(this._previewGroup);
    this._scene.remove(this._handleGroup);
    if (this._snapMesh) this._scene.remove(this._snapMesh);
  }
}
