/**
 * LaneSystem.js — Extracts drivable lane paths and graphs from roads and junctions.
 * Keeps navigation data strictly separate from 3D visual meshes.
 * Ready for Phase 3 A* pathfinding and IDM vehicle simulation.
 */

import * as THREE from 'three';

export class Lane {
  /**
   * @param {string} id
   * @param {string} roadId
   * @param {number} laneIndex
   * @param {number} direction — 1 for forward, -1 for backward
   * @param {number} offset — lateral offset from road centerline (meters)
   * @param {number} speedLimit
   */
  constructor(id, roadId, laneIndex, direction, offset, speedLimit) {
    this.id = id;
    this.roadId = roadId;
    this.laneIndex = laneIndex;
    this.direction = direction;
    this.offset = offset;
    this.speedLimit = speedLimit;
    this.waypoints = []; // Array of { position: Vector3, tangent: Vector3, dist: number }
    this.length = 0;
    this.nextLanes = []; // Lane IDs reachable from end of this lane
    this.prevLanes = [];
  }

  getPointAtDistance(d) {
    if (this.waypoints.length === 0) return new THREE.Vector3();
    if (d <= 0) return this.waypoints[0].position.clone();
    if (d >= this.length) return this.waypoints[this.waypoints.length - 1].position.clone();

    // Binary search
    let low = 0, high = this.waypoints.length - 1;
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.waypoints[mid].dist <= d) low = mid;
      else high = mid;
    }

    const wp0 = this.waypoints[low];
    const wp1 = this.waypoints[high];
    const factor = (d - wp0.dist) / (wp1.dist - wp0.dist || 1);
    return new THREE.Vector3().lerpVectors(wp0.position, wp1.position, factor);
  }

  getTangentAtDistance(d) {
    if (this.waypoints.length === 0) return new THREE.Vector3(0, 0, 1);
    if (d <= 0) return this.waypoints[0].tangent.clone();
    if (d >= this.length) return this.waypoints[this.waypoints.length - 1].tangent.clone();

    let low = 0, high = this.waypoints.length - 1;
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.waypoints[mid].dist <= d) low = mid;
      else high = mid;
    }
    return this.waypoints[low].tangent.clone();
  }
}

export class LaneSystem {
  constructor(roadNetwork) {
    this.roadNetwork = roadNetwork;
    this.lanes = new Map(); // laneId -> Lane
  }

  /**
   * Rebuild all lanes for a specific road segment.
   * @param {object} road
   */
  generateLanesForRoad(road) {
    // Remove existing lanes for this road
    for (const [id, lane] of this.lanes.entries()) {
      if (lane.roadId === road.id) {
        this.lanes.delete(id);
      }
    }

    const curve = road.curve;
    const roadType = road.type;
    const length = curve.length;
    const numSamples = Math.max(8, Math.ceil(length / 2.0)); // sample every 2m

    const newLanes = [];

    // Backward lanes (traffic flowing from End -> Start, offset < 0)
    for (let i = 0; i < roadType.lanesBackward; i++) {
      const laneIndex = i;
      const laneId = `${road.id}_b_${i}`;
      // Calculate offset from center
      const offset = -(roadType.laneWidth * (i + 0.5));
      const lane = new Lane(laneId, road.id, laneIndex, -1, offset, roadType.speedLimit);

      // Build waypoints in direction of traffic (t from 1 down to 0)
      let distAcc = 0;
      let prevPt = null;

      for (let s = numSamples; s >= 0; s--) {
        const t = s / numSamples;
        const pt = curve.getPoint(t);
        const norm = curve.getNormal(t);
        const tan = curve.getTangent(t).negate(); // backward tangent

        const lanePt = pt.clone().addScaledVector(norm, offset);
        lanePt.y += 0.1; // vehicle driving plane

        if (prevPt) {
          distAcc += prevPt.distanceTo(lanePt);
        }
        lane.waypoints.push({
          position: lanePt,
          tangent: tan,
          dist: distAcc,
        });
        prevPt = lanePt;
      }
      lane.length = distAcc;
      this.lanes.set(laneId, lane);
      newLanes.push(lane);
    }

    // Forward lanes (traffic flowing from Start -> End, offset > 0)
    for (let i = 0; i < roadType.lanesForward; i++) {
      const laneIndex = i;
      const laneId = `${road.id}_f_${i}`;
      const offset = roadType.laneWidth * (i + 0.5);
      const lane = new Lane(laneId, road.id, laneIndex, 1, offset, roadType.speedLimit);

      let distAcc = 0;
      let prevPt = null;

      for (let s = 0; s <= numSamples; s++) {
        const t = s / numSamples;
        const pt = curve.getPoint(t);
        const norm = curve.getNormal(t);
        const tan = curve.getTangent(t);

        const lanePt = pt.clone().addScaledVector(norm, offset);
        lanePt.y += 0.1;

        if (prevPt) {
          distAcc += prevPt.distanceTo(lanePt);
        }
        lane.waypoints.push({
          position: lanePt,
          tangent: tan,
          dist: distAcc,
        });
        prevPt = lanePt;
      }
      lane.length = distAcc;
      this.lanes.set(laneId, lane);
      newLanes.push(lane);
    }

    return newLanes;
  }

  /**
   * Connect lanes across an intersection node.
   * Incoming lanes will have outgoing lanes added to lane.nextLanes.
   */
  connectIntersectionLanes(intersection, connectedRoads) {
    // For each incoming lane, connect to all eligible outgoing lanes of other roads
    const incomingLanes = [];
    const outgoingLanes = [];

    connectedRoads.forEach(({ roadId, isStart }) => {
      for (const lane of this.lanes.values()) {
        if (lane.roadId !== roadId) continue;
        if (isStart) {
          // If at start of road: backward lanes arrive here (incoming), forward lanes leave here (outgoing)
          if (lane.direction === -1) incomingLanes.push(lane);
          else outgoingLanes.push(lane);
        } else {
          // If at end of road: forward lanes arrive here (incoming), backward lanes leave here (outgoing)
          if (lane.direction === 1) incomingLanes.push(lane);
          else outgoingLanes.push(lane);
        }
      }
    });

    // Link each incoming lane to outgoing lanes (excluding U-turns on same road)
    incomingLanes.forEach(inLane => {
      inLane.nextLanes = [];
      outgoingLanes.forEach(outLane => {
        if (outLane.roadId !== inLane.roadId) {
          inLane.nextLanes.push(outLane.id);
          outLane.prevLanes.push(inLane.id);
        }
      });
    });
  }

  getLane(id) {
    return this.lanes.get(id);
  }

  getAllLanes() {
    return Array.from(this.lanes.values());
  }

  removeLanesForRoad(roadId) {
    for (const [id, lane] of this.lanes.entries()) {
      if (lane.roadId === roadId) {
        this.lanes.delete(id);
      }
    }
  }

  clear() {
    this.lanes.clear();
  }
}

