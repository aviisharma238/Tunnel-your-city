/**
 * InstancedRenderer.js — High-performance 3D rendering of hundreds of vehicles
 * in a single WebGL draw call using Three.js InstancedMesh with per-instance colors and shadows.
 */

import * as THREE from 'three';

const MAX_VEHICLES = 2500;
const _dummy = new THREE.Object3D();

export class InstancedRenderer {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._carMesh = null;
    this._cabinMesh = null;
  }

  init() {
    this._createCarGeometry();
  }

  _createCarGeometry() {
    // 1. Stylized Car Body (lower chassis)
    const bodyGeo = new THREE.BoxGeometry(1.85, 0.75, 4.0);
    bodyGeo.translate(0, 0.38, 0);

    // Car material with per-instance color support
    const carMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, // will be tinted by instanceColor
    });

    this._carMesh = new THREE.InstancedMesh(bodyGeo, carMat, MAX_VEHICLES);
    this._carMesh.count = 0;
    this._carMesh.castShadow = true;
    this._carMesh.receiveShadow = false;
    this._carMesh.name = 'car_instances';
    this._carMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VEHICLES * 3), 3);
    this._scene.add(this._carMesh);

    // 2. Tinted Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.55, 0.62, 2.2);
    cabinGeo.translate(0, 0.75 + 0.31, -0.2); // positioned above body, slightly offset rearward

    const cabinMat = new THREE.MeshLambertMaterial({
      color: 0x1e293b, // dark charcoal tinted glass
    });

    this._cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, MAX_VEHICLES);
    this._cabinMesh.count = 0;
    this._cabinMesh.castShadow = true;
    this._cabinMesh.receiveShadow = false;
    this._cabinMesh.name = 'cabin_instances';
    this._scene.add(this._cabinMesh);
  }

  /**
   * Update all active vehicles in the scene.
   * Called every frame in the render loop.
   * @param {Array<import('../traffic/Vehicle').Vehicle>} vehicles
   */
  updateVehicles(vehicles) {
    if (!this._carMesh || !this._cabinMesh) return;

    const count = Math.min(vehicles.length, MAX_VEHICLES);
    this._carMesh.count = count;
    this._cabinMesh.count = count;

    for (let i = 0; i < count; i++) {
      const v = vehicles[i];
      _dummy.position.set(v.position.x, v.position.y, v.position.z);
      _dummy.rotation.set(0, v.heading, 0);

      // Adjust scale based on vehicle type (e.g. Bus / Van longer and taller)
      const scaleX = v.type.width / 1.9;
      const scaleY = v.type.height / 1.35;
      const scaleZ = v.type.length / 4.2;
      _dummy.scale.set(scaleX, scaleY, scaleZ);

      _dummy.updateMatrix();

      this._carMesh.setMatrixAt(i, _dummy.matrix);
      this._cabinMesh.setMatrixAt(i, _dummy.matrix);

      // Set vehicle paint color
      this._carMesh.setColorAt(i, v.color);
    }

    if (count > 0) {
      this._carMesh.instanceMatrix.needsUpdate = true;
      if (this._carMesh.instanceColor) this._carMesh.instanceColor.needsUpdate = true;
      this._cabinMesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    if (this._carMesh) {
      this._carMesh.geometry.dispose();
      this._carMesh.material.dispose();
      this._scene.remove(this._carMesh);
    }
    if (this._cabinMesh) {
      this._cabinMesh.geometry.dispose();
      this._cabinMesh.material.dispose();
      this._scene.remove(this._cabinMesh);
    }
  }
}
