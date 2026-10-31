/**
 * VehicleManager.js — Orchestrates vehicle lifecycle, object pooling,
 * lane-occupancy spatial sorting, leader-follower queries, and simulation ticks.
 */

import { Vehicle } from './Vehicle.js';
import { VEHICLE_TYPES, VEHICLE_COLORS } from './VehicleTypes.js';
import { Pathfinding } from './Pathfinding.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

const MAX_POOL_SIZE = 1500;

export class VehicleManager {
  /**
   * @param {import('../roads/LaneSystem').LaneSystem} laneSystem
   * @param {import('../roads/RoadNetwork').RoadNetwork} roadNetwork
   */
  constructor(laneSystem, roadNetwork) {
    this.laneSystem = laneSystem;
    this.roadNetwork = roadNetwork;
    this.pathfinding = new Pathfinding(laneSystem);

    this.activeVehicles = [];
    this.vehiclePool = [];

    // Lane -> sorted list of vehicles (by distanceAlongLane descending)
    this._laneOccupancy = new Map();

    // Spawner settings
    this.spawnInterval = 1.2; // seconds between auto-spawns
    this.spawnTimer = 0;
    this.maxVehicles = 500;
    this.isSpawningEnabled = true;

    // Traffic statistics
    this.stats = {
      activeCount: 0,
      averageSpeed: 0,
      congestionScore: 0,
    };
  }

  /**
   * Spawn a vehicle on a random available lane.
   */
  spawnVehicle(preferredLaneId = null, targetLaneId = null) {
    if (this.activeVehicles.length >= this.maxVehicles) return null;

    const allLanes = this.laneSystem.getAllLanes();
    if (allLanes.length === 0) return null;

    // Pick start lane
    let startLane = null;
    if (preferredLaneId) {
      startLane = this.laneSystem.getLane(preferredLaneId);
    }
    if (!startLane) {
      startLane = allLanes[Math.floor(Math.random() * allLanes.length)];
    }

    // Check if start of lane is clear (no vehicle within first 8m)
    const vehiclesOnLane = this._laneOccupancy.get(startLane.id) || [];
    const isStartBlocked = vehiclesOnLane.some(v => v.distanceAlongLane < 8.0);
    if (isStartBlocked) return null;

    // Pick random vehicle type (mostly Sedans, some Vans and Buses)
    const r = Math.random();
    let type = VEHICLE_TYPES.SEDAN;
    if (r > 0.85) type = VEHICLE_TYPES.BUS;
    else if (r > 0.65) type = VEHICLE_TYPES.VAN;

    // Acquire vehicle from pool or instantiate
    let vehicle = this.vehiclePool.pop();
    if (vehicle) {
      vehicle.reset(startLane.id, type);
    } else {
      vehicle = new Vehicle(startLane.id, type);
    }

    // Assign route if possible
    if (allLanes.length > 1) {
      let destLane = null;
      if (targetLaneId) {
        destLane = this.laneSystem.getLane(targetLaneId);
      }
      if (!destLane) {
        destLane = allLanes[Math.floor(Math.random() * allLanes.length)];
      }

      if (destLane && destLane.id !== startLane.id) {
        const route = this.pathfinding.findPath(startLane.id, destLane.id);
        if (route && route.length > 1) {
          route.shift(); // remove current start lane
          vehicle.route = route;
        }
      }
    }

    this.activeVehicles.push(vehicle);
    eventBus.emit(EVENTS.VEHICLE_SPAWNED, vehicle);
    return vehicle;
  }

  /**
   * Spawn N vehicles immediately for testing.
   */
  spawnBatch(count = 20) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      if (this.spawnVehicle()) spawned++;
    }
    return spawned;
  }

  /**
   * Clear all active vehicles back to pool.
   */
  clearAll() {
    this.activeVehicles.forEach(v => {
      v.active = false;
      if (this.vehiclePool.length < MAX_POOL_SIZE) {
        this.vehiclePool.push(v);
      }
    });
    this.activeVehicles = [];
    this._laneOccupancy.clear();
  }

  /**
   * Fixed-step simulation tick (runs at 20 Hz).
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    // 1. Auto-spawner
    if (this.isSpawningEnabled && this.activeVehicles.length < this.maxVehicles) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnVehicle();
      }
    }

    // 2. Build lane occupancy map (group & sort vehicles per lane)
    this._laneOccupancy.clear();
    for (let i = 0; i < this.activeVehicles.length; i++) {
      const v = this.activeVehicles[i];
      if (!v.active) continue;

      let list = this._laneOccupancy.get(v.laneId);
      if (!list) {
        list = [];
        this._laneOccupancy.set(v.laneId, list);
      }
      list.push(v);
    }

    // Sort vehicles on each lane descending by distanceAlongLane
    // (highest distance = furthest along lane = leader)
    for (const list of this._laneOccupancy.values()) {
      list.sort((a, b) => b.distanceAlongLane - a.distanceAlongLane);
    }

    // 3. Update each vehicle using IDM with its leader
    let totalSpeed = 0;
    let slowCount = 0;
    const remainingVehicles = [];

    for (let i = 0; i < this.activeVehicles.length; i++) {
      const v = this.activeVehicles[i];
      if (!v.active) {
        if (this.vehiclePool.length < MAX_POOL_SIZE) {
          this.vehiclePool.push(v);
        }
        continue;
      }

      // Find leader on current lane
      const laneVehicles = this._laneOccupancy.get(v.laneId) || [];
      const indexOnLane = laneVehicles.indexOf(v);
      let leader = null;
      let leaderDistance = null;

      if (indexOnLane > 0) {
        // Vehicle directly ahead on same lane
        leader = laneVehicles[indexOnLane - 1];
        leaderDistance = leader.distanceAlongLane - v.distanceAlongLane;
      } else {
        // First vehicle on this lane: look ahead into next lane if connected
        const currentLane = this.laneSystem.getLane(v.laneId);
        if (currentLane) {
          const distToEndOfLane = currentLane.length - v.distanceAlongLane;
          const nextLaneId = v.route?.[0] || currentLane.nextLanes?.[0];

          if (nextLaneId) {
            const nextLaneVehicles = this._laneOccupancy.get(nextLaneId) || [];
            if (nextLaneVehicles.length > 0) {
              // Last car on the next lane is closest to this lane's exit
              const candidateLeader = nextLaneVehicles[nextLaneVehicles.length - 1];
              leader = candidateLeader;
              leaderDistance = distToEndOfLane + candidateLeader.distanceAlongLane;
            }
          }
        }
      }

      // Execute IDM update
      v.update(dt, leader, leaderDistance, this.laneSystem, this.pathfinding);

      if (v.active) {
        remainingVehicles.push(v);
        totalSpeed += v.speed;
        if (v.speed < 2.5) slowCount++;
      } else {
        if (this.vehiclePool.length < MAX_POOL_SIZE) {
          this.vehiclePool.push(v);
        }
      }
    }

    this.activeVehicles = remainingVehicles;

    // 4. Update statistics
    const count = this.activeVehicles.length;
    this.stats.activeCount = count;
    this.stats.averageSpeed = count > 0 ? (totalSpeed / count) * 3.6 : 0; // km/h
    this.stats.congestionScore = count > 0 ? (slowCount / count) * 100 : 0; // 0..100%

    eventBus.emit(EVENTS.STATS_UPDATED, {
      vehicleCount: count,
      avgSpeed: Math.round(this.stats.averageSpeed),
      congestion: Math.round(this.stats.congestionScore),
    });
  }

  getVehicleCount() {
    return this.activeVehicles.length;
  }
}
