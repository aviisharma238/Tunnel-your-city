/**
 * RoadGeometry.js — Bézier math, arc-length parameterization,
 * and high-precision 3D mesh generation for roads, borders, markings, bridges,
 * roundabouts, and intersections matching the Trafficity screenshots (image.png).
 */

import * as THREE from 'three';

export class BezierCurve3D {
  /**
   * @param {THREE.Vector3} p0 Start point
   * @param {THREE.Vector3} p1 Start handle
   * @param {THREE.Vector3} p2 End handle
   * @param {THREE.Vector3} p3 End point
   */
  constructor(p0, p1, p2, p3) {
    this.p0 = p0.clone();
    this.p1 = p1.clone();
    this.p2 = p2.clone();
    this.p3 = p3.clone();

    this._lut = [];
    this._length = 0;
    this._computeLUT(64);
  }

  getPoint(t) {
    const it = 1 - t;
    const it2 = it * it;
    const it3 = it2 * it;
    const t2 = t * t;
    const t3 = t2 * t;

    return new THREE.Vector3(
      it3 * this.p0.x + 3 * it2 * t * this.p1.x + 3 * it * t2 * this.p2.x + t3 * this.p3.x,
      it3 * this.p0.y + 3 * it2 * t * this.p1.y + 3 * it * t2 * this.p2.y + t3 * this.p3.y,
      it3 * this.p0.z + 3 * it2 * t * this.p1.z + 3 * it * t2 * this.p2.z + t3 * this.p3.z
    );
  }

  getTangent(t) {
    const it = 1 - t;
    const it2 = it * it;
    const t2 = t * t;

    const tan = new THREE.Vector3(
      3 * it2 * (this.p1.x - this.p0.x) + 6 * it * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
      3 * it2 * (this.p1.y - this.p0.y) + 6 * it * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y),
      3 * it2 * (this.p1.z - this.p0.z) + 6 * it * t * (this.p2.z - this.p1.z) + 3 * t2 * (this.p3.z - this.p2.z)
    );

    if (tan.lengthSq() < 1e-6) {
      tan.subVectors(this.p3, this.p0);
    }
    return tan.normalize();
  }

  getNormal(t) {
    const tan = this.getTangent(t);
    return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  }

  _computeLUT(divisions = 64) {
    this._lut = [0];
    let prev = this.getPoint(0);
    let total = 0;

    for (let i = 1; i <= divisions; i++) {
      const t = i / divisions;
      const pt = this.getPoint(t);
      total += prev.distanceTo(pt);
      this._lut.push(total);
      prev = pt;
    }
    this._length = total;
  }

  get length() {
    return this._length;
  }

  getTFromDistance(distance) {
    if (distance <= 0) return 0;
    if (distance >= this._length) return 1;

    const n = this._lut.length - 1;
    let low = 0;
    let high = n;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this._lut[mid] < distance) low = mid + 1;
      else high = mid - 1;
    }

    const idx = Math.max(0, high);
    const d0 = this._lut[idx];
    const d1 = this._lut[idx + 1] || this._length;
    const factor = (distance - d0) / (d1 - d0 || 1);

    return (idx + factor) / n;
  }

  getPointAtDistance(distance) {
    return this.getPoint(this.getTFromDistance(distance));
  }

  getTangentAtDistance(distance) {
    return this.getTangent(this.getTFromDistance(distance));
  }

  getNormalAtDistance(distance) {
    return this.getNormal(this.getTFromDistance(distance));
  }
}

export function createBezierFromPoints(p0, p3, dir0 = null, dir3 = null, curvature = 0.5) {
  const dist = p0.distanceTo(p3);
  const handleLen = dist * curvature * 0.45;

  let p1, p2;

  if (dir0 && dir0.lengthSq() > 1e-4) {
    p1 = p0.clone().addScaledVector(dir0.clone().normalize(), handleLen);
  } else {
    const fwd = new THREE.Vector3().subVectors(p3, p0).normalize();
    p1 = p0.clone().addScaledVector(fwd, handleLen);
  }

  if (dir3 && dir3.lengthSq() > 1e-4) {
    p2 = p3.clone().addScaledVector(dir3.clone().normalize(), -handleLen);
  } else {
    const fwd = new THREE.Vector3().subVectors(p3, p0).normalize();
    p2 = p3.clone().addScaledVector(fwd, -handleLen);
  }

  return new BezierCurve3D(p0, p1, p2, p3);
}

/**
 * Convert 3-point bend curve (Start P0, Bend PBend, End P3) into an exact,
 * smooth cubic Bézier curve.
 */
export function createCurvedBezierWithBend(p0, pBend, p3) {
  const p1 = p0.clone().addScaledVector(new THREE.Vector3().subVectors(pBend, p0), 2 / 3);
  const p2 = p3.clone().addScaledVector(new THREE.Vector3().subVectors(pBend, p3), 2 / 3);
  return new BezierCurve3D(p0, p1, p2, p3);
}

/**
 * Generate 3D geometries for roads:
 * - Pure white road ribbon (#ffffff)
 * - Dark slate vector outline (#1f2937, 0.35m)
 * - Thin amber yellow center line (#f59e0b)
 * - Dashed white lane dividers
 * - Bridge abutment black tick marks and drop shadow
 */
export function generateRoadMeshes(curve, roadType, options = {}) {
  const length = curve.length;
  const stepDist = 1.8; // fine sampling for silky smooth curves
  const numSteps = Math.max(4, Math.ceil(length / stepDist));
  const totalWidth = roadType.totalWidth;
  const halfWidth = totalWidth / 2;
  const borderWidth = roadType.borderWidth || 0.35;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const borderPos = [];
  const borderNorm = [];
  const borderIdx = [];

  const centerLinePos = [];
  const centerLineIdx = [];

  const laneDividerPos = [];
  const laneDividerIdx = [];

  const abutmentPos = [];
  const abutmentIdx = [];

  let isBridge = false;

  for (let i = 0; i <= numSteps; i++) {
    const dist = (i / numSteps) * length;
    const pt = curve.getPointAtDistance(dist);
    const n = curve.getNormalAtDistance(dist);
    const tan = curve.getTangentAtDistance(dist);

    if (pt.y > 0.5) isBridge = true;

    const leftPt = pt.clone().addScaledVector(n, halfWidth);
    const rightPt = pt.clone().addScaledVector(n, -halfWidth);

    const yOffset = 0.05;
    leftPt.y += yOffset;
    rightPt.y += yOffset;

    // Main surface
    positions.push(leftPt.x, leftPt.y, leftPt.z);
    positions.push(rightPt.x, rightPt.y, rightPt.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, dist, 1, dist);

    // Dark vector border line
    const bOuterL = leftPt.clone().addScaledVector(n, borderWidth);
    const bOuterR = rightPt.clone().addScaledVector(n, -borderWidth);
    bOuterL.y += 0.01;
    bOuterR.y += 0.01;

    borderPos.push(bOuterL.x, bOuterL.y, bOuterL.z);
    borderPos.push(leftPt.x, leftPt.y + 0.01, leftPt.z);
    borderPos.push(rightPt.x, rightPt.y + 0.01, rightPt.z);
    borderPos.push(bOuterR.x, bOuterR.y, bOuterR.z);
    borderNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

    // Amber yellow center line
    if (roadType.hasCenterLine) {
      const cWidth = roadType.lanesTotal === 6 ? 0.6 : 0.28;
      const cL = pt.clone().addScaledVector(n, cWidth / 2);
      const cR = pt.clone().addScaledVector(n, -cWidth / 2);
      cL.y += yOffset + 0.02;
      cR.y += yOffset + 0.02;
      centerLinePos.push(cL.x, cL.y, cL.z, cR.x, cR.y, cR.z);
    }

    // Dashed white lane dividers
    if (roadType.hasLaneDividers) {
      const isDash = Math.floor(dist / 3.0) % 2 === 0;
      if (isDash) {
        const numDividersEachSide = roadType.lanesForward - 1;
        const laneW = roadType.laneWidth;
        for (let s = -1; s <= 1; s += 2) {
          for (let l = 1; l <= numDividersEachSide; l++) {
            const offset = s * (l * laneW);
            const dCenter = pt.clone().addScaledVector(n, offset);
            const dL = dCenter.clone().addScaledVector(n, 0.12);
            const dR = dCenter.clone().addScaledVector(n, -0.12);
            dL.y += yOffset + 0.02;
            dR.y += yOffset + 0.02;
            const baseIdx = laneDividerPos.length / 3;
            laneDividerPos.push(dL.x, dL.y, dL.z, dR.x, dR.y, dR.z);
          }
        }
      }
    }

    if (i < numSteps) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);

      const b0 = i * 4;
      const b1 = (i + 1) * 4;
      borderIdx.push(b0, b0 + 1, b1);
      borderIdx.push(b0 + 1, b1 + 1, b1);
      borderIdx.push(b0 + 2, b0 + 3, b1 + 2);
      borderIdx.push(b0 + 3, b1 + 3, b1 + 2);

      if (roadType.hasCenterLine) {
        const c0 = i * 2;
        centerLineIdx.push(c0, c0 + 1, c0 + 2);
        centerLineIdx.push(c0 + 1, c0 + 3, c0 + 2);
      }
    }
  }

  // Bridge abutment black tick marks (as in image.png)
  if (isBridge) {
    [0.05, 0.95].forEach(tVal => {
      const pt = curve.getPoint(tVal);
      const n = curve.getNormal(tVal);
      const leftAbut = pt.clone().addScaledVector(n, halfWidth + borderWidth + 0.6);
      const rightAbut = pt.clone().addScaledVector(n, -(halfWidth + borderWidth + 0.6));
      leftAbut.y += 0.15;
      rightAbut.y += 0.15;

      const aIdx = abutmentPos.length / 3;
      abutmentPos.push(
        leftAbut.x, leftAbut.y, leftAbut.z,
        leftAbut.x, leftAbut.y, leftAbut.z - 0.4,
        rightAbut.x, rightAbut.y, rightAbut.z,
        rightAbut.x, rightAbut.y, rightAbut.z - 0.4
      );
      abutmentIdx.push(aIdx, aIdx + 1, aIdx + 2, aIdx + 1, aIdx + 3, aIdx + 2);
    });
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
  borderGeo.setAttribute('normal', new THREE.Float32BufferAttribute(borderNorm, 3));
  borderGeo.setIndex(borderIdx);

  let centerLineGeo = null;
  if (roadType.hasCenterLine && centerLinePos.length > 0) {
    centerLineGeo = new THREE.BufferGeometry();
    centerLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerLinePos, 3));
    centerLineGeo.setIndex(centerLineIdx);
    centerLineGeo.computeVertexNormals();
  }

  let laneDividerGeo = null;
  if (laneDividerPos.length > 0) {
    laneDividerGeo = new THREE.BufferGeometry();
    laneDividerGeo.setAttribute('position', new THREE.Float32BufferAttribute(laneDividerPos, 3));
    laneDividerGeo.computeVertexNormals();
  }

  let abutmentGeo = null;
  if (abutmentPos.length > 0) {
    abutmentGeo = new THREE.BufferGeometry();
    abutmentGeo.setAttribute('position', new THREE.Float32BufferAttribute(abutmentPos, 3));
    abutmentGeo.setIndex(abutmentIdx);
    abutmentGeo.computeVertexNormals();
  }

  const pillars = [];
  if (isBridge) {
    const pillarSpacing = roadType.bridgePillarSpacing || 28;
    const numPillars = Math.floor(length / pillarSpacing);
    for (let k = 1; k <= numPillars; k++) {
      const dist = (k / (numPillars + 1)) * length;
      const pt = curve.getPointAtDistance(dist);
      if (pt.y > 1.5) {
        pillars.push({
          position: new THREE.Vector3(pt.x, pt.y / 2, pt.z),
          height: pt.y,
          width: totalWidth * 0.35,
        });
      }
    }
  }

  return {
    roadGeo,
    borderGeo,
    centerLineGeo,
    laneDividerGeo,
    abutmentGeo,
    isBridge,
    pillars,
  };
}

export function generateIntersectionGeometry(center, radius) {
  const segments = 36;
  const positions = [center.x, center.y + 0.05, center.z];
  const normals = [0, 1, 0];
  const indices = [];

  const borderPositions = [];
  const borderIndices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const rx = center.x + Math.cos(angle) * radius;
    const rz = center.z + Math.sin(angle) * radius;
    positions.push(rx, center.y + 0.05, rz);
    normals.push(0, 1, 0);

    if (i < segments) {
      indices.push(0, i + 1, i + 2);
    }
  }

  const borderW = 0.35;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const rx0 = center.x + Math.cos(angle) * radius;
    const rz0 = center.z + Math.sin(angle) * radius;
    const rx1 = center.x + Math.cos(angle) * (radius + borderW);
    const rz1 = center.z + Math.sin(angle) * (radius + borderW);

    borderPositions.push(rx0, center.y + 0.06, rz0);
    borderPositions.push(rx1, center.y + 0.06, rz1);

    if (i < segments) {
      const b = i * 2;
      borderIndices.push(b, b + 1, b + 2);
      borderIndices.push(b + 1, b + 3, b + 2);
    }
  }

  const surfaceGeo = new THREE.BufferGeometry();
  surfaceGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surfaceGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  surfaceGeo.setIndex(indices);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
  borderGeo.setIndex(borderIndices);
  borderGeo.computeVertexNormals();

  return { surfaceGeo, borderGeo };
}

export function generateRoundaboutGeometry(center, outerRadius = 22, innerRadius = 13) {
  const segments = 48;
  const positions = [];
  const normals = [];
  const indices = [];

  const borderPositions = [];
  const borderIndices = [];

  const centerPositions = [center.x, center.y + 0.12, center.z];
  const centerIndices = [];

  const yieldPos = [];
  const yieldIndices = [];

  const y = center.y + 0.05;
  const bW = 0.35;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const ox = center.x + cos * outerRadius;
    const oz = center.z + sin * outerRadius;
    const ix = center.x + cos * innerRadius;
    const iz = center.z + sin * innerRadius;

    positions.push(ox, y, oz);
    positions.push(ix, y, iz);
    normals.push(0, 1, 0, 0, 1, 0);

    centerPositions.push(ix, y + 0.08, iz);

    const bOutX = center.x + cos * (outerRadius + bW);
    const bOutZ = center.z + sin * (outerRadius + bW);
    const bInX = center.x + cos * (innerRadius - bW);
    const bInZ = center.z + sin * (innerRadius - bW);

    borderPositions.push(ox, y + 0.01, oz, bOutX, y + 0.01, bOutZ);
    borderPositions.push(ix, y + 0.01, iz, bInX, y + 0.01, bInZ);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);

      centerIndices.push(0, i + 1, i + 2);

      const b0 = i * 4;
      borderIndices.push(b0, b0 + 1, b0 + 4);
      borderIndices.push(b0 + 1, b0 + 5, b0 + 4);
      borderIndices.push(b0 + 2, b0 + 3, b0 + 6);
      borderIndices.push(b0 + 3, b0 + 7, b0 + 6);
    }
  }

  // Dotted yield lines across the 4 entry quadrants (matching image.png)
  [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach(angle => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpCos = -sin;
    const perpSin = cos;

    for (let d = -4; d <= 4; d += 1.8) {
      const px = center.x + cos * outerRadius + perpCos * d;
      const pz = center.z + sin * outerRadius + perpSin * d;
      const yIdx = yieldPos.length / 3;
      yieldPos.push(
        px, y + 0.03, pz,
        px + cos * 0.4, y + 0.03, pz + sin * 0.4
      );
      yieldIndices.push(yIdx, yIdx + 1);
    }
  });

  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ringGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  ringGeo.setIndex(indices);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
  borderGeo.setIndex(borderIndices);
  borderGeo.computeVertexNormals();

  const islandGeo = new THREE.BufferGeometry();
  islandGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerPositions, 3));
  islandGeo.setIndex(centerIndices);
  islandGeo.computeVertexNormals();

  return { ringGeo, borderGeo, islandGeo };
}
