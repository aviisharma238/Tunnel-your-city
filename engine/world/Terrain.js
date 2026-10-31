/**
 * Terrain.js — Recreates the exact minimalist, stylized cartographic world from
 * the Trafficity reference images (image.png):
 * - Clean off-white ground (#f3efe6)
 * - Top-left organic lake with sandy beach shore (#8faee6 / #f0dfb2)
 * - Bottom-left contoured mountain with tiered charcoal shading (#596066 / #454c52 / #363b3f)
 * - Residential neighborhood grass zones with cute green-roof houses & white driveways
 * - Blue commercial buildings with parking lots
 * - Industrial warehouse at bottom right
 */

import * as THREE from 'three';

const MAP_SIZE = 2400;

export class Terrain {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = 'terrain_features_group';
    this._scene.add(this._group);

    this._grid = null;
  }

  init() {
    this._createBaseCanvas();
    this._createLake();
    this._createContourHills();
    this._createNeighborhoods();
    this._createBuildings();
    this._createGrid();
  }

  _createBaseCanvas() {
    // Pure warm cream canvas (#ede8de) matching image.png exactly
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xede8de,
      side: THREE.FrontSide,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    ground.name = 'base_ground';
    this._group.add(ground);
  }

  _createLake() {
    // Top-left organic water lake with sandy beach
    const lakeGroup = new THREE.Group();
    lakeGroup.position.set(-200, 0, -180);

    // Sand shore
    const sandShape = new THREE.Shape();
    sandShape.moveTo(-180, -140);
    sandShape.bezierCurveTo(-140, 20, 20, 40, 60, -20);
    sandShape.bezierCurveTo(90, -80, 50, -180, -80, -220);
    sandShape.bezierCurveTo(-150, -240, -200, -200, -180, -140);

    const sandGeo = new THREE.ShapeGeometry(sandShape);
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xefdfb5 });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.position.y = 0.01;
    sandMesh.receiveShadow = true;
    lakeGroup.add(sandMesh);

    // Blue water
    const lakeShape = new THREE.Shape();
    lakeShape.moveTo(-160, -130);
    lakeShape.bezierCurveTo(-130, 0, 0, 20, 40, -30);
    lakeShape.bezierCurveTo(70, -80, 30, -160, -70, -200);
    lakeShape.bezierCurveTo(-130, -220, -180, -180, -160, -130);

    const lakeGeo = new THREE.ShapeGeometry(lakeShape);
    const lakeMat = new THREE.MeshLambertMaterial({ color: 0x8faee6 });
    const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.position.y = 0.02;
    lakeMesh.receiveShadow = true;
    lakeGroup.add(lakeMesh);

    this._group.add(lakeGroup);
  }

  _createContourHills() {
    // Bottom-left smooth contoured mountain with 3 tiered shades of charcoal (matching image.png)
    const hillGroup = new THREE.Group();
    hillGroup.position.set(-180, 0, 160);

    const tiers = [
      { radiusX: 130, radiusZ: 110, height: 8,  color: 0x596066, y: 4 },
      { radiusX: 100, radiusZ: 85,  height: 16, color: 0x454c52, y: 12 },
      { radiusX: 68,  radiusZ: 58,  height: 24, color: 0x363b3f, y: 20 },
    ];

    tiers.forEach(tier => {
      const geo = new THREE.CylinderGeometry(tier.radiusX * 0.92, tier.radiusX, tier.height, 36);
      geo.scale(1, 1, tier.radiusZ / tier.radiusX);
      const mat = new THREE.MeshLambertMaterial({
        color: tier.color,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = tier.y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      hillGroup.add(mesh);
    });

    // Right-side mountain (as seen on the right border of image.png)
    const rightHill = new THREE.Group();
    rightHill.position.set(240, 0, 40);
    const rightTiers = [
      { radiusX: 90, radiusZ: 130, height: 10, color: 0x596066, y: 5 },
      { radiusX: 65, radiusZ: 95,  height: 18, color: 0x454c52, y: 14 },
    ];
    rightTiers.forEach(t => {
      const geo = new THREE.CylinderGeometry(t.radiusX * 0.9, t.radiusX, t.height, 32);
      geo.scale(1, 1, t.radiusZ / t.radiusX);
      const mat = new THREE.MeshLambertMaterial({ color: t.color, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = t.y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      rightHill.add(mesh);
    });

    this._group.add(hillGroup);
    this._group.add(rightHill);
  }

  _createNeighborhoods() {
    // Soft pastel green grass zones for residential areas (matching image.png)
    const grassMat = new THREE.MeshLambertMaterial({ color: 0xd8e4bf });

    // North residential block
    const northGrass = new THREE.Mesh(new THREE.PlaneGeometry(130, 90), grassMat);
    northGrass.rotation.x = -Math.PI / 2;
    northGrass.position.set(50, 0.01, -110);
    northGrass.receiveShadow = true;
    this._group.add(northGrass);

    // West residential road strip
    const westGrass = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), grassMat);
    westGrass.rotation.x = -Math.PI / 2;
    westGrass.rotation.z = -0.15; // aligned with road curve
    westGrass.position.set(-110, 0.01, -45);
    westGrass.receiveShadow = true;
    this._group.add(westGrass);
  }

  _createBuildings() {
    // Materials
    const houseRoofMat = new THREE.MeshLambertMaterial({ color: 0x5cb352 }); // vivid green gable roof
    const houseWallMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // white walls
    const drivewayMat = new THREE.MeshBasicMaterial({ color: 0xffffff });   // white driveway pavement
    const blueBuildingMat = new THREE.MeshLambertMaterial({ color: 0x2563eb }); // blue commercial roof
    const indRoofMat = new THREE.MeshLambertMaterial({ color: 0x52585f });    // dark grey industrial roof

    // 1. Houses along Western Road (as in image.png)
    for (let i = 0; i < 7; i++) {
      const hGroup = new THREE.Group();
      const x = -50 - i * 18;
      const z = -25 - i * 3.5;
      hGroup.position.set(x, 0, z);

      // White driveway connecting house to road
      const driveGeo = new THREE.PlaneGeometry(3.5, 9);
      const driveMesh = new THREE.Mesh(driveGeo, drivewayMat);
      driveMesh.rotation.x = -Math.PI / 2;
      driveMesh.position.set(0, 0.02, 4.5);
      hGroup.add(driveMesh);

      // House walls
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), houseWallMat);
      wallMesh.position.y = 1.5;
      wallMesh.castShadow = true;
      hGroup.add(wallMesh);

      // Green gable roof
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.5, 4), houseRoofMat);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.position.y = 4.2;
      roofMesh.castShadow = true;
      hGroup.add(roofMesh);

      this._group.add(hGroup);
    }

    // 2. Houses in North Cul-de-sac
    const northCoords = [
      { x: 30, z: -85 }, { x: 50, z: -85 }, { x: 70, z: -85 },
      { x: 30, z: -125 }, { x: 50, z: -125 }, { x: 70, z: -125 },
    ];
    northCoords.forEach(pos => {
      const hGroup = new THREE.Group();
      hGroup.position.set(pos.x, 0, pos.z);

      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 6), houseWallMat);
      wallMesh.position.y = 1.5;
      wallMesh.castShadow = true;
      hGroup.add(wallMesh);

      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.4, 4), houseRoofMat);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.position.y = 4.2;
      roofMesh.castShadow = true;
      hGroup.add(roofMesh);

      this._group.add(hGroup);
    });

    // 3. Blue Commercial Building on Western Road (matching image.png)
    const commGroup = new THREE.Group();
    commGroup.position.set(-85, 0, 10);

    // Blue building
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 12), blueBuildingMat);
    bMesh.position.y = 2.5;
    bMesh.castShadow = true;
    commGroup.add(bMesh);

    // Parking lot with white stall lines
    const lotMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshLambertMaterial({ color: 0xede8de }));
    lotMesh.rotation.x = -Math.PI / 2;
    lotMesh.position.set(0, 0.02, -10);
    commGroup.add(lotMesh);

    // White parking bay stripes
    for (let s = -3; s <= 3; s++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 7), drivewayMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(s * 2.4, 0.03, -10);
      commGroup.add(stripe);
    }

    this._group.add(commGroup);

    // 4. Industrial Building at bottom right (matching image.png)
    const indGroup = new THREE.Group();
    indGroup.position.set(130, 0, 130);
    const indMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 20), indRoofMat);
    indMesh.position.y = 3.5;
    indMesh.castShadow = true;
    indGroup.add(indMesh);

    // Blue highlight section
    const indAccent = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 4), blueBuildingMat);
    indAccent.position.set(0, 6, 8);
    indGroup.add(indAccent);

    this._group.add(indGroup);
  }

  _createGrid() {
    // Very subtle, minimalist guideline grid
    this._grid = new THREE.GridHelper(MAP_SIZE, 120, 0xe2ded4, 0xeeeae2);
    this._grid.position.y = 0.03;
    this._grid.name = 'terrain_grid';
    this._scene.add(this._grid);
  }

  setGridVisible(visible) {
    if (this._grid) this._grid.visible = visible;
  }

  dispose() {
    this._scene.remove(this._group);
    if (this._grid) this._scene.remove(this._grid);
    this._group.children.forEach(c => {
      c.geometry?.dispose();
      c.material?.dispose();
    });
  }
}
