/**
 * GameEngine — top-level controller.
 * Owns GameLoop, World, Environment, Terrain, RoadNetwork, LaneSystem,
 * RoadRenderer, RoadBuilder, VehicleManager, and InstancedRenderer.
 * Zero React imports.
 */

import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { eventBus, EVENTS } from './EventBus.js';
import { World } from './World.js';
import { Terrain } from '../world/Terrain.js';
import { Environment } from '../world/Environment.js';
import { CameraController } from '../rendering/Camera.js';
import { LaneSystem } from '../roads/LaneSystem.js';
import { RoadNetwork } from '../roads/RoadNetwork.js';
import { RoadRenderer } from '../roads/RoadRenderer.js';
import { RoadBuilder } from '../roads/RoadBuilder.js';
import { ROAD_TYPES, ELEVATION_LEVELS } from '../roads/RoadTypes.js';
import { VehicleManager } from '../traffic/VehicleManager.js';
import { InstancedRenderer } from '../rendering/InstancedRenderer.js';

export class GameEngine {
  constructor() {
    this.loop = new GameLoop();
    this.world = new World();
    this.terrain = null;
    this.environment = null;
    this.cameraController = null;

    // Road subsystems
    this.laneSystem = null;
    this.roadNetwork = null;
    this.roadRenderer = null;
    this.roadBuilder = null;

    // Traffic subsystems (Phase 3)
    this.vehicleManager = null;
    this.instancedRenderer = null;

    this._initialized = false;
  }

  /**
   * Initialize the engine with Three.js scene, renderer, and camera.
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   */
  async init(scene, renderer, camera) {
    if (this._initialized) return;
    this._initialized = true;

    this.world.scene = scene;
    this.world.renderer = renderer;
    this.world.camera = camera;

    // 1. World & Environment
    this.terrain = new Terrain(scene);
    this.terrain.init();

    this.environment = new Environment(scene, renderer);
    this.environment.init();

    // 2. Camera controller
    this.cameraController = new CameraController(camera, renderer.domElement);

    // 3. Road subsystems
    this.laneSystem = new LaneSystem(null);
    this.roadNetwork = new RoadNetwork(this.laneSystem);
    this.laneSystem.roadNetwork = this.roadNetwork;

    this.roadRenderer = new RoadRenderer(scene);
    this.roadBuilder = new RoadBuilder(
      this.roadNetwork,
      this.roadRenderer,
      camera,
      renderer.domElement
    );

    // 4. Traffic & Vehicle rendering subsystems (Phase 3)
    this.instancedRenderer = new InstancedRenderer(scene);
    this.instancedRenderer.init();

    this.vehicleManager = new VehicleManager(this.laneSystem, this.roadNetwork);

    // Set initial tool to road builder
    this.roadBuilder.setTool('road');

    // 5. Create initial demo road layout and spawn initial cars
    this._createStarterCity();

    // 6. Register simulation tick callback for Vehicle AI
    this.loop.onSimTick((dt) => {
      this.vehicleManager?.update(dt);
    });

    // 7. Start fixed-step simulation loop (20 Hz)
    this.loop.start();
    eventBus.emit(EVENTS.ENGINE_READY);
    console.log('[GameEngine] Initialized with Road & Traffic Engines.');
  }

  /**
   * Generate an initial starter network and spawn traffic.
   */
  _createStarterCity() {
    try {
      // Main 4-lane Avenue running West to East
      this.roadNetwork.addRoad(
        new THREE.Vector3(-140, 0, 0),
        new THREE.Vector3(140, 0, 0),
        ROAD_TYPES.AVENUE
      );

      // North-South connecting Local Road with T-junction
      this.roadNetwork.addRoad(
        new THREE.Vector3(0, 0, -100),
        new THREE.Vector3(0, 0, 0),
        ROAD_TYPES.LOCAL
      );

      // Elevated Flyover Bridge crossing over the avenue
      this.roadNetwork.addRoad(
        new THREE.Vector3(-60, 0, -80),
        new THREE.Vector3(60, 0, 80),
        ROAD_TYPES.RAMP,
        {
          elevationStart: ELEVATION_LEVELS.BRIDGE,
          elevationEnd: ELEVATION_LEVELS.BRIDGE,
        }
      );

      // Rebuild meshes
      this.roadBuilder._rebuildAllMeshes();

      // Spawn initial fleet of 25 vehicles
      setTimeout(() => {
        if (this.vehicleManager) {
          this.vehicleManager.spawnBatch(25);
        }
      }, 200);
    } catch (err) {
      console.error('[GameEngine] Error creating starter city:', err);
    }
  }

  /**
   * Called every frame via useFrame at 60fps.
   */
  renderFrame(delta) {
    const dtMs = delta * 1000;
    this.environment?.update(dtMs);
    this.cameraController?.update(dtMs);

    // Render vehicles in InstancedMesh
    if (this.instancedRenderer && this.vehicleManager) {
      this.instancedRenderer.updateVehicles(this.vehicleManager.activeVehicles);
    }
  }

  pause() { this.loop.pause(); }
  resume() { this.loop.resume(); }

  setSpeed(multiplier) {
    this.loop.speedMultiplier = multiplier;
  }

  destroy() {
    this.loop.destroy();
    this.cameraController?.dispose();
    this.roadBuilder?.dispose();
    this.roadRenderer?.dispose();
    this.instancedRenderer?.dispose();
    this.vehicleManager?.clearAll();
    this.terrain?.dispose();
    this.environment?.dispose();
    eventBus.clear();
    this._initialized = false;
    console.log('[GameEngine] Destroyed.');
  }
}

// Singleton
export const gameEngine = new GameEngine();
