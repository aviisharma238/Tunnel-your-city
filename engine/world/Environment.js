/**
 * Environment — ambient lighting, sun, sky, fog, day/night cycle.
 * Phase 1: static late-afternoon sun with shadows.
 * Phase 7+: full day/night cycle, weather.
 */

import * as THREE from 'three';

export class Environment {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(scene, renderer) {
    this._scene = scene;
    this._renderer = renderer;
    this._sun = null;
    this._ambient = null;
    this._hemi = null;
    this._time = 0;
  }

  init() {
    this._setupRenderer();
    this._setupFog();
    this._setupSky();
    this._setupLights();
  }

  _setupRenderer() {
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.0;
    this._renderer.setClearColor(0x0a1520);
  }

  _setupFog() {
    this._scene.fog = new THREE.FogExp2(0x1a2535, 0.0006);
  }

  _setupSky() {
    this._scene.background = new THREE.Color(0x1a2535);
  }

  _setupLights() {
    // Hemisphere light — sky/ground ambient
    this._hemi = new THREE.HemisphereLight(0x87ceeb, 0x2d4a1e, 0.4);
    this._hemi.name = 'hemi_light';
    this._scene.add(this._hemi);

    // Ambient fill
    this._ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this._scene.add(this._ambient);

    // Directional sun
    this._sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    this._sun.position.set(200, 400, 200);
    this._sun.castShadow = true;

    // Shadow map config
    const s = this._sun.shadow;
    s.mapSize.width = 2048;
    s.mapSize.height = 2048;
    s.camera.near = 1;
    s.camera.far = 1500;
    s.camera.left = -400;
    s.camera.right = 400;
    s.camera.top = 400;
    s.camera.bottom = -400;
    s.bias = -0.0005;

    this._sun.name = 'sun';
    this._scene.add(this._sun);
    this._scene.add(this._sun.target);
  }

  /** Called every render frame. dt in ms. */
  update(dt) {
    // Phase 7: animate day/night here
    this._time += dt;
  }

  dispose() {
    [this._sun, this._ambient, this._hemi].forEach(l => {
      if (l) this._scene.remove(l);
    });
  }
}
