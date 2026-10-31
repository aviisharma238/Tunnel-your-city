/**
 * GameEngine — top-level controller.
 * Owns the GameLoop (simulation-only), registers all engine systems.
 * Rendering is driven by R3F's useFrame via the renderFrame() method.
 * Has zero React imports.
 */

import { GameLoop } from './GameLoop.js';
import { eventBus, EVENTS } from './EventBus.js';
import { World } from './World.js';
import { Terrain } from '../world/Terrain.js';
import { Environment } from '../world/Environment.js';
import { CameraController } from '../rendering/Camera.js';

export class GameEngine {
  constructor() {
    this.loop = new GameLoop();
    this.world = new World();
    this.terrain = null;
    this.environment = null;
    this.cameraController = null;
    this._initialized = false;
  }

  /**
   * Initialize the engine with a Three.js scene reference.
   * Called once after the R3F canvas mounts.
   * @param {import('three').Scene} scene
   * @param {import('three').WebGLRenderer} renderer
   * @param {import('three').Camera} camera
   */
  async init(scene, renderer, camera) {
    if (this._initialized) return;
    this._initialized = true;

    this.world.scene = scene;
    this.world.renderer = renderer;
    this.world.camera = camera;

    // Initialize subsystems
    this.terrain = new Terrain(scene);
    this.terrain.init();

    this.environment = new Environment(scene, renderer);
    this.environment.init();

    // Camera controller — attaches mouse/keyboard events to the canvas
    this.cameraController = new CameraController(camera, renderer.domElement);

    // Start fixed-step simulation loop (20 Hz)
    // Rendering is driven by R3F's useFrame, NOT by the GameLoop RAF
    this.loop.start();
    eventBus.emit(EVENTS.ENGINE_READY);
    console.log('[GameEngine] Initialized and running.');
  }

  /**
   * Called every R3F frame (60fps) via useFrame in EngineMount.
   * @param {number} delta  — seconds since last frame (from R3F clock)
   */
  renderFrame(delta) {
    const dtMs = delta * 1000;
    this.environment?.update(dtMs);
    this.cameraController?.update(dtMs);
  }

  pause() { this.loop.pause(); }
  resume() { this.loop.resume(); }

  setSpeed(multiplier) {
    this.loop.speedMultiplier = multiplier;
  }

  destroy() {
    this.loop.destroy();
    this.cameraController?.dispose();
    eventBus.clear();
    this._initialized = false;
    console.log('[GameEngine] Destroyed.');
  }
}

// Singleton
export const gameEngine = new GameEngine();
