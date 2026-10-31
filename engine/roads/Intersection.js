/**
 * Intersection.js — Logic and representation of junctions where roads meet.
 * Computes junction boundaries, fillet connections, stop lines,
 * and internal lane connections for traffic navigation.
 */

import * as THREE from 'three';
import { generateIntersectionGeometry } from './RoadGeometry.js';

export class Intersection {
  /**
   * @param {string} nodeId
   * @param {THREE.Vector3} center
   */
  constructor(nodeId, center) {
    this.id = `int_${nodeId}`;
    this.nodeId = nodeId;
    this.center = center.clone();
    this.connectedRoads = []; // array of { roadId, angle, width, isStart }
    this.radius = 8;
    this.hasTrafficLight = false;
    this.signalPhases = [];
    this.currentPhaseIndex = 0;
    this.phaseTimer = 0;
  }

  /**
   * Recalculate junction radius and geometry data when connected roads change.
   * @param {Array<{roadId: string, angle: number, width: number, isStart: boolean}>} roads
   */
  updateConnections(roads) {
    this.connectedRoads = roads.sort((a, b) => a.angle - b.angle);

    // Compute appropriate junction radius based on widest road
    let maxWidth = 9;
    roads.forEach(r => {
      if (r.width > maxWidth) maxWidth = r.width;
    });

    // For 2 roads (continuation/bend): smaller radius
    // For 3+ roads (T or 4-way): wider junction
    if (roads.length <= 2) {
      this.radius = maxWidth * 0.55;
    } else {
      this.radius = maxWidth * 0.75 + (roads.length - 2) * 1.5;
    }

    this.radius = Math.max(6, Math.min(24, this.radius));
  }

  /**
   * Generate 3D geometries for the intersection surface and border.
   */
  generateGeometries() {
    const angles = this.connectedRoads.map(r => r.angle);
    const widths = this.connectedRoads.map(r => r.width);
    return generateIntersectionGeometry(this.center, this.radius, angles, widths);
  }

  /**
   * Check if a 2D world point is inside this intersection.
   */
  containsPoint(point, tolerance = 1.0) {
    const dx = point.x - this.center.x;
    const dz = point.z - this.center.z;
    return (dx * dx + dz * dz) <= Math.pow(this.radius + tolerance, 2);
  }
}

