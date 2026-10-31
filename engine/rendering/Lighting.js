/**
 * Lighting — additional scene lighting helpers.
 * The main sun/sky setup is in Environment.js.
 * This module handles street lights and point light pooling for Phase 4+.
 */

// Placeholder for Phase 4
export class LightingManager {
  constructor(scene) {
    this._scene = scene;
    this._streetLights = [];
  }

  // Phase 4: add street lights along roads
  addStreetLight(position) {
    // TODO: PointLight + pole mesh
  }

  dispose() {
    this._streetLights.forEach(l => this._scene.remove(l));
    this._streetLights = [];
  }
}
