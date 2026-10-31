/**
 * Environment.js — Ambient lighting, sun, sky, and soft shadows
 * calibrated for Trafficity's clean, bright cartographic aesthetic (image.png).
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
    this._setupSky();
    this._setupLights();
  }

  _setupRenderer() {
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.05;
    this._renderer.setClearColor(0xede8de);
  }

  _setupSky() {
    this._scene.background = new THREE.Color(0xede8de);
    this._scene.fog = new THREE.FogExp2(0xede8de, 0.0003);
  }

  _setupLights() {
    // Hemisphere light — warm daylight from above, soft bounce from below
    this._hemi = new THREE.HemisphereLight(0xffffff, 0xe5dfd3, 0.7);
    this._hemi.name = 'hemi_light';
    this._scene.add(this._hemi);

    // Soft ambient fill
    this._ambient = new THREE.AmbientLight(0xfffbf0, 0.35);
    this._scene.add(this._ambient);

    // Directional sunlight positioned North-West so shadows fall South-East (matching image.png)
    this._sun = new THREE.DirectionalLight(0xfffbf2, 1.4);
    this._sun.position.set(-140, 340, -160);
    this._sun.castShadow = true;

    // High quality shadow configuration
    const s = this._sun.shadow;
    s.mapSize.width = 2048;
    s.mapSize.height = 2048;
    s.camera.near = 10;
    s.camera.far = 1000;
    s.camera.left = -320;
    s.camera.right = 320;
    s.camera.top = 320;
    s.camera.bottom = -320;
    s.bias = -0.0004;

    this._sun.name = 'sun';
    this._scene.add(this._sun);
    this._scene.add(this._sun.target);
  }

  update(dt) {
    this._time += dt;
  }

  dispose() {
    [this._sun, this._ambient, this._hemi].forEach(l => {
      if (l) this._scene.remove(l);
    });
  }
}
