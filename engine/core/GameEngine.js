/**
 * GameEngine — top-level controller.
 * Orchestrates the full Trafficity world replication:
 * - Exact layout matching sample images (image.png):
 *   Central roundabout, curved western residential avenue with houses and lake,
 *   sweeping curved highway, flyover bridge with overpass shadow,
 *   and 270° cloverleaf loop ramp with active traffic!
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

    // 1. Terrain & Stylized Environment matching image.png (grid removed)
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
    this.vehicleManager.spawnInterval = 0.8;
    this.vehicleManager.maxVehicles = 400;

    // Set initial tool to road builder
    this.roadBuilder.setTool('road');

    // 5. Create the iconic Trafficity starter scene with smooth curved roads
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
   * Recreate the exact network from image.png with real sweeping curves:
   * 1. Central Roundabout
   * 2. S-Curved Western Road curving around the mountain & lake
   * 3. Curved Northern Residential Street
   * 4. Sweeping Curved Divided Highway
   * 5. Curved Flyover Bridge crossing over Highway with drop shadow
   * 6. Smooth 270° Cloverleaf Loop Ramp
   * 7. Smooth on-ramp from Roundabout south to Highway
   */
  _createStarterCity() {
    try {
      const rn = this.roadNetwork;

      // 1. Central Roundabout at (0, 0)
      const roundaboutCenter = new THREE.Vector3(0, 0, 0);
      rn.createRoundabout(roundaboutCenter, 22);

      // 2. S-Curved Western Road curving around mountain & past blue building to the lake
      // Segment 1: from roundabout exit (-22, 0, 0) curving past blue building to (-95, 0, 10)
      rn.addRoad(
        new THREE.Vector3(-22, 0, 0),
        new THREE.Vector3(-95, 0, 10),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(-55, 0, 0),
          p2: new THREE.Vector3(-75, 0, 10),
        }
      );

      // Segment 2: continuing past houses to the lake shore at (-195, 0, -45)
      rn.addRoad(
        new THREE.Vector3(-95, 0, 10),
        new THREE.Vector3(-195, 0, -45),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(-130, 0, 10),
          p2: new THREE.Vector3(-165, 0, -30),
        }
      );

      // 3. Curved Northern Residential Street extending North
      rn.addRoad(
        new THREE.Vector3(0, 0, -22),
        new THREE.Vector3(10, 0, -115),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(0, 0, -55),
          p2: new THREE.Vector3(8, 0, -85),
        }
      );

      // Northern cul-de-sac branch
      rn.addRoad(
        new THREE.Vector3(5, 0, -85),
        new THREE.Vector3(65, 0, -85),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(25, 0, -85),
          p2: new THREE.Vector3(45, 0, -85),
        }
      );

      // 4. Sweeping Curved Divided Highway running South to North
      rn.addRoad(
        new THREE.Vector3(70, 0, 180),
        new THREE.Vector3(170, 0, -180),
        ROAD_TYPES.HIGHWAY,
        {
          p1: new THREE.Vector3(85, 0, 70),
          p2: new THREE.Vector3(120, 0, -60),
        }
      );

      // 5. Curved Flyover Bridge crossing over the Highway:
      // Exits East from roundabout, curves into bridge approach
      rn.addRoad(
        new THREE.Vector3(22, 0, 0),
        new THREE.Vector3(68, 0, -6),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(38, 0, 0),
          p2: new THREE.Vector3(52, 0, -6),
        }
      );

      // Elevated Flyover Avenue Bridge crossing over Highway at +8m
      rn.addRoad(
        new THREE.Vector3(68, 0, -6),
        new THREE.Vector3(150, 0, 24),
        ROAD_TYPES.AVENUE,
        {
          p1: new THREE.Vector3(92, 8, 2),
          p2: new THREE.Vector3(124, 8, 14),
          elevationStart: ELEVATION_LEVELS.BRIDGE,
          elevationEnd: ELEVATION_LEVELS.BRIDGE,
        }
      );

      // 6. Smooth 270° Cloverleaf Loop Ramp from Flyover Bridge down to Highway
      // Loop upper half
      rn.addRoad(
        new THREE.Vector3(138, 8, 20),
        new THREE.Vector3(175, 4, 50),
        ROAD_TYPES.RAMP,
        {
          p1: new THREE.Vector3(165, 8, 22),
          p2: new THREE.Vector3(182, 6, 35),
          elevationStart: ELEVATION_LEVELS.BRIDGE,
          elevationEnd: ELEVATION_LEVELS.BRIDGE / 2,
        }
      );

      // Loop lower half merging to highway
      rn.addRoad(
        new THREE.Vector3(175, 4, 50),
        new THREE.Vector3(118, 0, 85),
        ROAD_TYPES.RAMP,
        {
          p1: new THREE.Vector3(168, 2, 75),
          p2: new THREE.Vector3(140, 0, 85),
          elevationStart: ELEVATION_LEVELS.BRIDGE / 2,
          elevationEnd: 0,
        }
      );

      // 7. Direct Curved On-Ramp from Roundabout South to Highway
      rn.addRoad(
        new THREE.Vector3(15, 0, 20),
        new THREE.Vector3(80, 0, 130),
        ROAD_TYPES.RAMP,
        {
          p1: new THREE.Vector3(20, 0, 60),
          p2: new THREE.Vector3(55, 0, 105),
        }
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
