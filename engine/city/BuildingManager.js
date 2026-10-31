/**
 * BuildingManager.js — Manages residential, commercial, and industrial buildings.
 * Replicates the visual and gameplay mechanics from Trafficity:
 * - Houses with driveways along roads
 * - Dynamic roof color reflecting noise & congestion (Green -> Yellow -> Orange -> Red)
 * - Commercial stores with parking stalls
 * - Industrial warehouses with loading docks
 */

import * as THREE from 'three';

export class BuildingManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../roads/RoadNetwork').RoadNetwork} roadNetwork
   */
  constructor(scene, roadNetwork) {
    this._scene = scene;
    this.roadNetwork = roadNetwork;

    this.group = new THREE.Group();
    this.group.name = 'city_buildings_group';
    this._scene.add(this.group);

    this.houses = []; // array of { mesh, roofMesh, position, nearbyRoadId }
    this.commercialBuildings = [];
    this.industrialBuildings = [];

    this._initMaterials();
  }

  _initMaterials() {
    this.matWall = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.matDriveway = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.matBlueStore = new THREE.MeshLambertMaterial({ color: 0x2563eb });
    this.matIndustrial = new THREE.MeshLambertMaterial({ color: 0x52585f });
    this.matIndustrialAccent = new THREE.MeshLambertMaterial({ color: 0xe27233 }); // orange accent

    // Roof satisfaction color states (from image copy 5.png)
    this.roofColors = {
      happy: new THREE.Color(0x22c55e),     // green: quiet / low traffic
      moderate: new THREE.Color(0xfacc15),  // yellow: mild noise
      annoyed: new THREE.Color(0xf97316),   // orange: traffic delays
      unhappy: new THREE.Color(0xef4444),   // red: severe congestion & noise
    };
  }

  /**
   * Add a residential house with a driveway.
   */
  addHouse(x, z, rotation = 0, roadId = null) {
    const hGroup = new THREE.Group();
    hGroup.position.set(x, 0, z);
    hGroup.rotation.y = rotation;

    // Driveway strip
    const driveGeo = new THREE.PlaneGeometry(3.5, 9);
    const driveMesh = new THREE.Mesh(driveGeo, this.matDriveway);
    driveMesh.rotation.x = -Math.PI / 2;
    driveMesh.position.set(0, 0.02, 4.5);
    hGroup.add(driveMesh);

    // House walls
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 6.2), this.matWall);
    wallMesh.position.y = 1.6;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    hGroup.add(wallMesh);

    // Gable roof (individual material instance for color change)
    const roofMat = new THREE.MeshLambertMaterial({ color: this.roofColors.happy });
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.5, 4), roofMat);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.y = 4.4;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    hGroup.add(roofMesh);

    this.group.add(hGroup);

    const houseObj = {
      group: hGroup,
      roofMat,
      position: new THREE.Vector3(x, 0, z),
      roadId,
    };
    this.houses.push(houseObj);
    return houseObj;
  }

  /**
   * Add a commercial store with parking stalls (matching image.png).
   */
  addCommercial(x, z, rotation = 0) {
    const commGroup = new THREE.Group();
    commGroup.position.set(x, 0, z);
    commGroup.rotation.y = rotation;

    // Blue building body
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(18, 5.5, 12), this.matBlueStore);
    bMesh.position.y = 2.75;
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    commGroup.add(bMesh);

    // Parking lot
    const lotMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 11), new THREE.MeshLambertMaterial({ color: 0xede8de }));
    lotMesh.rotation.x = -Math.PI / 2;
    lotMesh.position.set(0, 0.02, -10.5);
    lotMesh.receiveShadow = true;
    commGroup.add(lotMesh);

    // White parking bay stripes
    for (let s = -3.5; s <= 3.5; s += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 7.5), this.matDriveway);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(s * 2.4, 0.03, -10.5);
      commGroup.add(stripe);
    }

    this.group.add(commGroup);
    this.commercialBuildings.push(commGroup);
    return commGroup;
  }

  /**
   * Add an industrial factory with loading docks (matching image copy 2.png).
   */
  addIndustrial(x, z, rotation = 0) {
    const indGroup = new THREE.Group();
    indGroup.position.set(x, 0, z);
    indGroup.rotation.y = rotation;

    // Main factory warehouse
    const indMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 7.5, 22), this.matIndustrial);
    indMesh.position.y = 3.75;
    indMesh.castShadow = true;
    indMesh.receiveShadow = true;
    indGroup.add(indMesh);

    // Orange accent roof ventilation
    const vent = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 5), this.matIndustrialAccent);
    vent.position.set(0, 7.5 + 1.0, 6);
    vent.castShadow = true;
    indGroup.add(vent);

    // Loading bays
    for (let b = -2; b <= 2; b++) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.5, 2), this.matWall);
      dock.position.set(b * 5.8, 1.75, -11.5);
      indGroup.add(dock);
    }

    this.group.add(indGroup);
    this.industrialBuildings.push(indGroup);
    return indGroup;
  }

  /**
   * Update house roof colors based on traffic congestion on nearby roads.
   * If a road is jammed, houses nearby turn orange or red (image copy 5.png).
   * @param {import('../traffic/VehicleManager').VehicleManager} vehicleManager
   */
  updateSatisfaction(vehicleManager) {
    if (!vehicleManager) return;

    // Check congestion score
    const avgSpeed = vehicleManager.stats.averageSpeed;
    const congestion = vehicleManager.stats.congestionScore;

    this.houses.forEach(house => {
      let color = this.roofColors.happy;

      if (congestion > 50 || avgSpeed < 15) {
        color = this.roofColors.unhappy; // red
      } else if (congestion > 30 || avgSpeed < 25) {
        color = this.roofColors.annoyed; // orange
      } else if (congestion > 15 || avgSpeed < 35) {
        color = this.roofColors.moderate; // yellow
      }

      house.roofMat.color.lerp(color, 0.2);
    });
  }

  clear() {
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      child.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
      });
    }
    this.houses = [];
    this.commercialBuildings = [];
    this.industrialBuildings = [];
  }

  dispose() {
    this._scene.remove(this.group);
    this.clear();
  }
}

