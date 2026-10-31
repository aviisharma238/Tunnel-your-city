/**
 * GameEngine — top-level controller.
 * Orchestrates the full Trafficity world replication:
 * - Exact layout matching sample images (image.png):
 *   Central roundabout, western residential avenue with houses and lake,
 *   diagonal divided highway, flyover bridge with overpass shadow,
 *   and cloverleaf loop ramp with active traffic!
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

    // Traffic subsystems
    this.vehicleManager = null;
    this.instancedRenderer = null;

    this._initialized = false;
  }

  async init(scene, renderer, camera) {
    if (this._initialized) return;
    this._initialized = true;

    this.world.scene = scene;
    this.world.renderer = renderer;
    this.world.camera = camera;

    // 1. Terrain & Stylized Environment matching image.png
    this.terrain = new Terrain(scene);
    this.terrain.init();

    this.environment = new Environment(scene, renderer);
    this.environment.init();

    // 2. Camera controller (starts in pure top-down cartographic view)
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

    // 4. Traffic & Multi-colored Instanced vehicle renderer
    this.instancedRenderer = new InstancedRenderer(scene);
    this.instancedRenderer.init();

    this.vehicleManager = new VehicleManager(this.laneSystem, this.roadNetwork);
    this.vehicleManager.spawnInterval = 0.8; // frequent cars
    this.vehicleManager.maxVehicles = 400;

    // Set initial tool to road builder
    this.roadBuilder.setTool('road');

    // 5. Create the iconic Trafficity starter scene from image.png
    this._createStarterCity();

    // 6. Register fixed 20 Hz simulation tick
    this.loop.onSimTick((dt) => {
      this.vehicleManager?.update(dt);
    });

    // 7. Start engine loop
    this.loop.start();
    eventBus.emit(EVENTS.ENGINE_READY);
    console.log('[GameEngine] Running Trafficity-accurate world simulation.');
  }

  /**
   * Recreate the exact network from image.png:
   * 1. Central Roundabout
   * 2. Western Road with Houses & Driveways leading past the Lake
   * 3. Northern Residential Street
   * 4. Diagonal Multi-Lane Highway
   * 5. Flyover Bridge crossing over Highway with drop shadow & abutments
   * 6. Cloverleaf Loop Ramp connecting Flyover to Highway
   * 7. Smooth on-ramp from Roundabout south to Highway
   */
  _createStarterCity() {
    try {
      const rn = this.roadNetwork;

      // 1. Central Roundabout at (0, 0)
      const roundaboutCenter = new THREE.Vector3(0, 0, 0);
      rn.createRoundabout(roundaboutCenter, 22);

      // 2. Western Local Road extending past the houses towards the lake
      rn.addRoad(
        new THREE.Vector3(-22, 0, 0),
        new THREE.Vector3(-180, 0, -35),
        ROAD_TYPES.LOCAL
      );

      // 3. Northern Residential Street extending North
      rn.addRoad(
        new THREE.Vector3(0, 0, -22),
        new THREE.Vector3(0, 0, -110),
        ROAD_TYPES.LOCAL
      );

      // Northern residential cross street
      rn.addRoad(
        new THREE.Vector3(-25, 0, -90),
        new THREE.Vector3(65, 0, -90),
        ROAD_TYPES.LOCAL
      );

      // 4. Diagonal Divided Highway running from South-West to North-East
      rn.addRoad(
        new THREE.Vector3(60, 0, 160),
        new THREE.Vector3(160, 0, -170),
        ROAD_TYPES.HIGHWAY
      );

      // 5. Flyover Bridge crossing over the Highway:
      // Exits East from roundabout, rises to +8m bridge level over highway, and lands East
      rn.addRoad(
        new THREE.Vector3(22, 0, 5),
        new THREE.Vector3(70, 0, 10),
        ROAD_TYPES.LOCAL
      );

      rn.addRoad(
        new THREE.Vector3(70, 0, 10),
        new THREE.Vector3(145, 0, 20),
        ROAD_TYPES.AVENUE,
        {
          elevationStart: ELEVATION_LEVELS.BRIDGE,
          elevationEnd: ELEVATION_LEVELS.BRIDGE,
        }
      );

      // 6. Cloverleaf Loop Ramp from Flyover Bridge down to Highway
      // 270 degree loop connecting bridge at (135, 8, 20) looping south to highway at (120, 0, 75)
      rn.addRoad(
        new THREE.Vector3(135, 8, 20),
        new THREE.Vector3(165, 4, 45),
        ROAD_TYPES.RAMP,
        {
          elevationStart: ELEVATION_LEVELS.BRIDGE,
          elevationEnd: ELEVATION_LEVELS.BRIDGE / 2,
        }
      );

      rn.addRoad(
        new THREE.Vector3(165, 4, 45),
        new THREE.Vector3(120, 0, 75),
        ROAD_TYPES.RAMP,
        {
          elevationStart: ELEVATION_LEVELS.BRIDGE / 2,
          elevationEnd: 0,
        }
      );

      // 7. On-ramp curve from Roundabout South to Highway
      rn.addRoad(
        new THREE.Vector3(0, 0, 22),
        new THREE.Vector3(25, 0, 65),
        ROAD_TYPES.RAMP
      );

      rn.addRoad(
        new THREE.Vector3(25, 0, 65),
        new THREE.Vector3(75, 0, 130),
        ROAD_TYPES.RAMP
      );

      // Rebuild all road and intersection meshes
      this.roadBuilder._rebuildAllMeshes();

      // Spawn initial fleet of vibrant cars across the roads
      setTimeout(() => {
        if (this.vehicleManager) {
          this.vehicleManager.spawnBatch(35);
        }
      }, 250);
    } catch (err) {
      console.error('[GameEngine] Error creating starter city:', err);
    }
  }

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
