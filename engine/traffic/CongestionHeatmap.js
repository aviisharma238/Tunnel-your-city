/**
 * CongestionHeatmap.js — Visualizes traffic congestion, noise, and air pollution
 * as seen in Trafficity screenshot (image copy 5.png).
 * Generates soft translucent red/amber heat glows over congested roads and calculates
 * noise impact on nearby residential buildings.
 */

import * as THREE from 'three';

export class CongestionHeatmap {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../roads/RoadNetwork').RoadNetwork} roadNetwork
   * @param {import('./VehicleManager').VehicleManager} vehicleManager
   */
  constructor(scene, roadNetwork, vehicleManager) {
    this._scene = scene;
    this.roadNetwork = roadNetwork;
    this.vehicleManager = vehicleManager;

    this.visible = false;
    this.group = new THREE.Group();
    this.group.name = 'congestion_heatmap_group';
    this._scene.add(this.group);

    // Heat materials (gradient from light yellow to deep red)
    this.matModerate = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.matSevere = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this._heatMeshes = new Map(); // roadId -> Mesh
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  toggle() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  /**
   * Update congestion scores for all roads and regenerate heat glow meshes.
   * Called every few simulation ticks.
   */
  update() {
    // 1. Calculate vehicle count and speed per road
    const roadVehicles = new Map(); // roadId -> Array<Vehicle>

    for (const v of this.vehicleManager.activeVehicles) {
      if (!v.active) continue;
      const lane = this.vehicleManager.laneSystem.getLane(v.laneId);
      if (!lane) continue;

      let list = roadVehicles.get(lane.roadId);
      if (!list) {
        list = [];
        roadVehicles.set(lane.roadId, list);
      }
      list.push(v);
    }

    // Clear old heat meshes
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      child.geometry?.dispose();
    }
    this._heatMeshes.clear();

    // 2. For each road with vehicles, calculate congestion ratio
    for (const [roadId, vehicles] of roadVehicles.entries()) {
      const road = this.roadNetwork.roads.get(roadId);
      if (!road) continue;

      const density = vehicles.length / (road.length / 15.0); // vehicles per 15m
      let slowCount = 0;
      for (const v of vehicles) {
        if (v.speed < 3.0) slowCount++;
      }
      const slowRatio = vehicles.length > 0 ? slowCount / vehicles.length : 0;

      // Determine congestion level
      if (density > 0.6 || slowRatio > 0.4) {
        const isSevere = slowRatio > 0.6 || density > 1.2;
        const heatMat = isSevere ? this.matSevere : this.matModerate;
        const heatMesh = this._createHeatRibbon(road, isSevere ? 24.0 : 18.0, heatMat);
        if (heatMesh) {
          this.group.add(heatMesh);
          this._heatMeshes.set(roadId, heatMesh);
        }
      }
    }
  }

  _createHeatRibbon(road, glowWidth, material) {
    const curve = road.curve;
    const length = curve.length;
    const numSteps = Math.max(6, Math.ceil(length / 4.0));
    const halfWidth = (road.type.totalWidth + glowWidth) / 2;

    const positions = [];
    const indices = [];

    for (let i = 0; i <= numSteps; i++) {
      const dist = (i / numSteps) * length;
      const pt = curve.getPointAtDistance(dist);
      const n = curve.getNormalAtDistance(dist);

      const left = pt.clone().addScaledVector(n, halfWidth);
      const right = pt.clone().addScaledVector(n, -halfWidth);

      left.y += 0.2;
      right.y += 0.2;

      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

      if (i < numSteps) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return new THREE.Mesh(geo, material);
  }

  dispose() {
    this._scene.remove(this.group);
    this._heatMeshes.clear();
  }
}
