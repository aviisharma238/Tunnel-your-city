/**
 * GameEngine — top-level controller.
 * Orchestrates all subsystems to replicate the exact Trafficity gameplay and visual identity:
 * - Real curved roads, multi-tier bridges with drop shadows, and roundabouts
 * - Microscopic IDM traffic simulation with colorful vehicles
 * - BuildingManager with dynamic house satisfaction roof colors (image copy 5.png)
 * - Congestion & Noise Heatmap overlay (image copy 5.png)
 * - Seamless grid-less stone canvas
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
import { BuildingManager } from '../city/BuildingManager.js';
import { CongestionHeatmap } from '../traffic/CongestionHeatmap.js';

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
    this.heatmap = null;

    // City & Buildings subsystem
    this.buildingManager = null;

    this._initialized = false;
  }

  async init(scene, renderer, camera) {
    if (this._initialized) return;
    this._initialized = true;

    this.world.scene = scene;
    this.world.renderer = renderer;
    this.world.camera = camera;

    // 1. Terrain & Environment (grid-free organic canvas)
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

    // 5. City Buildings & Congestion Heatmap
    this.buildingManager = new BuildingManager(scene, this.roadNetwork);
    this.heatmap = new CongestionHeatmap(scene, this.roadNetwork, this.vehicleManager);

    // Set initial tool to road builder
    this.roadBuilder.setTool('road');

    // 6. Create the iconic Trafficity starter scene
    this._createStarterCity();

    // 7. Register fixed 20 Hz simulation tick
    let heatTimer = 0;
    this.loop.onSimTick((dt) => {
      this.vehicleManager?.update(dt);
      this.buildingManager?.updateSatisfaction(this.vehicleManager);

      heatTimer += dt;
      if (heatTimer >= 0.5) {
        heatTimer = 0;
        if (this.heatmap?.visible) this.heatmap.update();
      }
    });

    // 8. Start engine loop
    this.loop.start();
    eventBus.emit(EVENTS.ENGINE_READY);
    console.log('[GameEngine] Running Trafficity-accurate world simulation.');
  }

  /**
   * Recreate the exact network from image.png with real sweeping curves and buildings:
   */
  _createStarterCity() {
    try {
      const rn = this.roadNetwork;

      // 1. Central Roundabout at (0, 0)
      const roundaboutCenter = new THREE.Vector3(0, 0, 0);
      rn.createRoundabout(roundaboutCenter, 22);

      // 2. S-Curved Western Road curving around mountain & past blue building to the lake
      rn.addRoad(
        new THREE.Vector3(-22, 0, 0),
        new THREE.Vector3(-95, 0, 10),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(-55, 0, 0),
          p2: new THREE.Vector3(-75, 0, 10),
        }
      );

      rn.addRoad(
        new THREE.Vector3(-95, 0, 10),
        new THREE.Vector3(-195, 0, -45),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(-130, 0, 10),
          p2: new THREE.Vector3(-165, 0, -30),
        }
      );

      // 3. Curved Northern Residential Street
      rn.addRoad(
        new THREE.Vector3(0, 0, -22),
        new THREE.Vector3(10, 0, -115),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(0, 0, -55),
          p2: new THREE.Vector3(8, 0, -85),
        }
      );

      rn.addRoad(
        new THREE.Vector3(5, 0, -85),
        new THREE.Vector3(65, 0, -85),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(25, 0, -85),
          p2: new THREE.Vector3(45, 0, -85),
        }
      );

      // 4. Sweeping Curved Divided Highway
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
      rn.addRoad(
        new THREE.Vector3(22, 0, 0),
        new THREE.Vector3(68, 0, -6),
        ROAD_TYPES.LOCAL,
        {
          p1: new THREE.Vector3(38, 0, 0),
          p2: new THREE.Vector3(52, 0, -6),
        }
      );

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

      // 8. Place dynamic houses along roads with driveways (Trafficity style)
      if (this.buildingManager) {
        // Houses along western curved road
        for (let i = 0; i < 7; i++) {
          const x = -50 - i * 18;
          const z = -25 - i * 3.5;
          this.buildingManager.addHouse(x, z, -0.15);
        }

        // Houses in northern residential block
        const northPositions = [
          { x: 30, z: -70 }, { x: 50, z: -70 }, { x: 70, z: -70 },
          { x: 30, z: -100 }, { x: 50, z: -100 }, { x: 70, z: -100 },
        ];
        northPositions.forEach(p => this.buildingManager.addHouse(p.x, p.z, 0));

        // Commercial store with parking lot
        this.buildingManager.addCommercial(-85, 12, 0);

        // Industrial factory
        this.buildingManager.addIndustrial(135, 135, -Math.PI / 4);
      }

      // Rebuild meshes
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

  toggleHeatmap() {
    if (!this.heatmap) return false;
    const isVis = this.heatmap.toggle();
    if (isVis) this.heatmap.update();
    return isVis;
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
    this.buildingManager?.dispose();
    this.heatmap?.dispose();
    this.terrain?.dispose();
    this.environment?.dispose();
    eventBus.clear();
    this._initialized = false;
    console.log('[GameEngine] Destroyed.');
  }
}

// Singleton
export const gameEngine = new GameEngine();
