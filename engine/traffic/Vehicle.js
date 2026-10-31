/**
 * Vehicle.js — Microscopic agent-based vehicle simulation.
 * Implements the industry-standard Intelligent Driver Model (IDM) for realistic
 * acceleration, smooth following distance, and queueing behavior.
 */

import * as THREE from 'three';
import { VEHICLE_TYPES, VEHICLE_COLORS } from './VehicleTypes.js';

let nextVehicleId = 1;

export class Vehicle {
  /**
   * @param {string} laneId
   * @param {import('./VehicleTypes').VEHICLE_TYPES} type
   * @param {THREE.Color} color
   */
  constructor(laneId, type = VEHICLE_TYPES.SEDAN, color = null) {
    this.id = nextVehicleId++;
    this.type = type;
    this.color = color || VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];

    this.laneId = laneId;
    this.distanceAlongLane = 0; // distance in meters from lane start
    this.speed = 8.0;           // current speed (m/s)
    this.acceleration = 0;      // m/s²
    this.desiredSpeed = type.maxSpeed; // target speed (m/s)

    this.position = new THREE.Vector3();
    this.tangent = new THREE.Vector3(0, 0, 1);
    this.heading = 0; // rotation around Y axis in radians

    this.route = []; // array of next lane IDs
    this.active = true;
    this.state = 'driving'; // 'driving' | 'braking' | 'stopped' | 'arrived'

    // IDM parameters
    this.s0 = type.minGap || 2.5;              // minimum standing gap (m)
    this.T = type.timeHeadway || 1.4;          // safe time headway (s)
    this.aMax = type.maxAcceleration || 2.8;   // maximum acceleration (m/s²)
    this.b = type.comfortableDecel || 3.0;     // comfortable deceleration (m/s²)
    this.delta = 4;                            // acceleration exponent
  }

  /**
   * Reset vehicle for object pooling / respawn.
   */
  reset(laneId, type = VEHICLE_TYPES.SEDAN) {
    this.laneId = laneId;
    this.type = type;
    this.distanceAlongLane = 0;
    this.speed = 6.0;
    this.acceleration = 0;
    this.desiredSpeed = type.maxSpeed;
    this.route = [];
    this.active = true;
    this.state = 'driving';
  }

  /**
   * Update vehicle physics via IDM.
   * @param {number} dt — simulation step time (seconds)
   * @param {Vehicle | null} leader — vehicle directly ahead on same lane
   * @param {number} leaderDistance — gap to leader vehicle in meters
   * @param {import('../roads/LaneSystem').LaneSystem} laneSystem
   * @param {import('./Pathfinding').Pathfinding} pathfinding
   */
  update(dt, leader, leaderDistance, laneSystem, pathfinding) {
    if (!this.active) return;

    const lane = laneSystem.getLane(this.laneId);
    if (!lane) {
      this.active = false;
      return;
    }

    // Road speed limit conversion (km/h -> m/s)
    const roadSpeedLimitMs = (lane.speedLimit || 50) / 3.6;
    const v0 = Math.min(this.type.maxSpeed, roadSpeedLimitMs);

    // IDM Free-road term: a * (1 - (v / v0)^delta)
    const v = Math.max(0, this.speed);
    const freeTerm = this.aMax * (1 - Math.pow(v / v0, this.delta));

    // IDM Interaction term with leading car
    let interactionTerm = 0;
    if (leader && leaderDistance !== null && leaderDistance < 80.0) {
      const deltaV = v - leader.speed;
      const sStar = this.s0 + Math.max(0, v * this.T + (v * deltaV) / (2 * Math.sqrt(this.aMax * this.b)));
      const actualGap = Math.max(0.5, leaderDistance - this.type.length);
      interactionTerm = -this.aMax * Math.pow(sStar / actualGap, 2);
    }

    // End-of-lane / dead-end braking check
    const distToEnd = lane.length - this.distanceAlongLane;
    if (distToEnd < 25.0 && (!this.route || this.route.length === 0) && lane.nextLanes.length === 0) {
      // Approaching dead end without connections: decelerate smoothly to stop
      const sStarStop = this.s0 + (v * v) / (2 * this.b);
      interactionTerm -= this.aMax * Math.pow(sStarStop / Math.max(1.0, distToEnd), 2);
    }

    // Total acceleration
    this.acceleration = freeTerm + interactionTerm;
    // Clamp acceleration between emergency braking and max acceleration
    this.acceleration = Math.max(-8.0, Math.min(this.aMax, this.acceleration));

    // Update velocity and distance
    this.speed = Math.max(0, this.speed + this.acceleration * dt);
    this.distanceAlongLane += this.speed * dt;

    // Check driving state
    if (this.speed < 0.2) this.state = 'stopped';
    else if (this.acceleration < -1.0) this.state = 'braking';
    else this.state = 'driving';

    // Check lane transition
    if (this.distanceAlongLane >= lane.length) {
      this._transitionToNextLane(lane, laneSystem, pathfinding);
    }

    // Update 3D world position & heading from lane curve
    const currentLane = laneSystem.getLane(this.laneId);
    if (currentLane) {
      this.position.copy(currentLane.getPointAtDistance(this.distanceAlongLane));
      this.tangent.copy(currentLane.getTangentAtDistance(this.distanceAlongLane));
      this.heading = Math.atan2(this.tangent.x, this.tangent.z);
    }
  }

  _transitionToNextLane(currentLane, laneSystem, pathfinding) {
    let nextLaneId = null;

    if (this.route && this.route.length > 0) {
      nextLaneId = this.route.shift();
    } else if (pathfinding) {
      nextLaneId = pathfinding.chooseNextLane(this.laneId);
    }

    if (nextLaneId && laneSystem.getLane(nextLaneId)) {
      const overshoot = this.distanceAlongLane - currentLane.length;
      this.laneId = nextLaneId;
      this.distanceAlongLane = Math.max(0, overshoot);
    } else {
      // Reached destination / dead end
      this.state = 'arrived';
      this.active = false;
    }
  }
}

