/**
 * Pathfinding.js — A* pathfinding and route planning on the Lane Graph.
 * Finds optimal sequences of lanes from origin to destination.
 */

import * as THREE from 'three';

export class Pathfinding {
  /**
   * @param {import('../roads/LaneSystem').LaneSystem} laneSystem
   */
  constructor(laneSystem) {
    this.laneSystem = laneSystem;
  }

  /**
   * Find path from startLane to goalLane using A*.
   * @param {string} startLaneId
   * @param {string} goalLaneId
   * @returns {string[] | null} Array of lane IDs or null if no route
   */
  findPath(startLaneId, goalLaneId) {
    if (startLaneId === goalLaneId) {
      return [startLaneId];
    }

    const startLane = this.laneSystem.getLane(startLaneId);
    const goalLane = this.laneSystem.getLane(goalLaneId);
    if (!startLane || !goalLane) return null;

    const goalPos = goalLane.getPointAtDistance(0);

    // Open set priority queue (min-heap or sorted array)
    const openSet = new Set([startLaneId]);
    const cameFrom = new Map(); // laneId -> predecessor laneId

    const gScore = new Map(); // laneId -> cost from start
    gScore.set(startLaneId, 0);

    const fScore = new Map(); // laneId -> estimated total cost
    fScore.set(startLaneId, this._heuristic(startLane, goalPos));

    let iterations = 0;
    const maxIterations = 200;

    while (openSet.size > 0 && iterations++ < maxIterations) {
      // Find node in openSet with lowest fScore
      let currentId = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId === goalLaneId) {
        // Reconstruct path
        return this._reconstructPath(cameFrom, currentId);
      }

      openSet.delete(currentId);
      const currentLane = this.laneSystem.getLane(currentId);
      if (!currentLane) continue;

      const currentG = gScore.get(currentId) || 0;

      for (const nextId of currentLane.nextLanes) {
        const nextLane = this.laneSystem.getLane(nextId);
        if (!nextLane) continue;

        // Cost: travel time (length / speed in m/s)
        const speedMs = Math.max(5, (nextLane.speedLimit || 50) / 3.6);
        const stepCost = (nextLane.length / speedMs);
        const tentativeG = currentG + stepCost;

        if (tentativeG < (gScore.get(nextId) ?? Infinity)) {
          cameFrom.set(nextId, currentId);
          gScore.set(nextId, tentativeG);
          const f = tentativeG + this._heuristic(nextLane, goalPos);
          fScore.set(nextId, f);
          openSet.add(nextId);
        }
      }
    }

    return null; // No path found
  }

  _heuristic(lane, goalPos) {
    const laneEnd = lane.getPointAtDistance(lane.length);
    const dist = laneEnd.distanceTo(goalPos);
    return dist / 25.0; // estimated time at 90 km/h
  }

  _reconstructPath(cameFrom, currentId) {
    const totalPath = [currentId];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId);
      totalPath.unshift(currentId);
    }
    return totalPath;
  }

  /**
   * Pick next lane stochastically if no global path is set (random walk).
   */
  chooseNextLane(currentLaneId) {
    const lane = this.laneSystem.getLane(currentLaneId);
    if (!lane || lane.nextLanes.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * lane.nextLanes.length);
    return lane.nextLanes[randomIndex];
  }
}
