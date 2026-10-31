/**
 * InstancedRenderer — manages InstancedMesh pools for vehicles and buildings.
 * Phase 1: stub with placeholder geometry.
 * Phase 3: fully wired to VehicleManager's SharedArrayBuffer state.
 */

import * as THREE from 'three';

const MAX_VEHICLES = 2000;

const _dummy = new THREE.Object3D();

export class InstancedRenderer {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._vehicleMesh = null;
  }

  init() {
    // Placeholder box geometry for vehicles
    const geo = new THREE.BoxGeometry(2, 1.2, 4.5);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
    this._vehicleMesh = new THREE.InstancedMesh(geo, mat, MAX_VEHICLES);
    this._vehicleMesh.count = 0; // no vehicles yet
    this._vehicleMesh.castShadow = true;
    this._vehicleMesh.receiveShadow = false;
    this._vehicleMesh.name = 'vehicle_instances';
    this._scene.add(this._vehicleMesh);
  }

  /**
   * Update vehicle instance transforms from flat array.
   * @param {Float32Array} positions  — [x,y,z, x,y,z, ...]
   * @param {Float32Array} rotations  — [ry, ry, ...]
   * @param {number} count
   */
  updateVehicles(positions, rotations, count) {
    if (!this._vehicleMesh) return;
    this._vehicleMesh.count = count;
    for (let i = 0; i < count; i++) {
      _dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      _dummy.rotation.y = rotations[i];
      _dummy.updateMatrix();
      this._vehicleMesh.setMatrixAt(i, _dummy.matrix);
    }
    this._vehicleMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this._vehicleMesh) {
      this._vehicleMesh.geometry.dispose();
      this._vehicleMesh.material.dispose();
      this._scene.remove(this._vehicleMesh);
    }
  }
}
