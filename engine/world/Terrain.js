/**
 * Terrain — creates the ground plane and grid helper.
 * Phase 1: flat 2km × 2km terrain, grey asphalt-like ground.
 * Phase 7+: heightmap with adjustable elevation.
 */

import * as THREE from 'three';

const TERRAIN_SIZE = 2000; // metres (2 km²)
const GRID_DIVISIONS = 100;
const GRID_SIZE = TERRAIN_SIZE;

export class Terrain {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._ground = null;
    this._grid = null;
    this._subGrid = null;
  }

  init() {
    this._createGround();
    this._createGrid();
  }

  _createGround() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 1, 1);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x1a2318,   // dark green-grey — open land
      side: THREE.FrontSide,
    });
    this._ground = new THREE.Mesh(geo, mat);
    this._ground.rotation.x = -Math.PI / 2;
    this._ground.receiveShadow = true;
    this._ground.name = 'terrain_ground';
    this._scene.add(this._ground);
  }

  _createGrid() {
    // Major grid lines every 100m
    this._grid = new THREE.GridHelper(
      GRID_SIZE, GRID_DIVISIONS,
      0x2d3a2d,  // major line colour
      0x1e2a1e   // minor line colour
    );
    this._grid.position.y = 0.05; // slightly above ground to avoid z-fight
    this._grid.name = 'terrain_grid';
    this._scene.add(this._grid);

    // Sub-grid every 10m (lighter)
    this._subGrid = new THREE.GridHelper(
      GRID_SIZE, GRID_DIVISIONS * 10,
      0x1e2a1e,
      0x161e16
    );
    this._subGrid.position.y = 0.02;
    this._subGrid.name = 'terrain_subgrid';
    this._scene.add(this._subGrid);
  }

  /** Toggle grid visibility */
  setGridVisible(visible) {
    if (this._grid) this._grid.visible = visible;
    if (this._subGrid) this._subGrid.visible = visible;
  }

  dispose() {
    [this._ground, this._grid, this._subGrid].forEach(obj => {
      if (!obj) return;
      obj.geometry?.dispose();
      obj.material?.dispose();
      this._scene.remove(obj);
    });
  }
}
