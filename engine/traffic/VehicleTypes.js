/**
 * VehicleTypes.js — Specifications and color palettes for vehicles in Game City.
 * Matches the vibrant, cute minimalist look from Trafficity screenshots.
 */

import * as THREE from 'three';

export const VEHICLE_COLORS = [
  new THREE.Color(0x38bdf8), // Cyan / Sky Blue
  new THREE.Color(0x2563eb), // Deep Royal Blue
  new THREE.Color(0xf97316), // Vivid Orange
  new THREE.Color(0xfacc15), // Taxi Yellow
  new THREE.Color(0x10b981), // Emerald Green
  new THREE.Color(0xef4444), // Coral Red
  new THREE.Color(0xa855f7), // Purple / Violet
  new THREE.Color(0xec4899), // Pink
  new THREE.Color(0x64748b), // Slate / Silver
  new THREE.Color(0x14b8a6), // Teal
];

export const VEHICLE_TYPES = {
  SEDAN: {
    id: 'sedan',
    name: 'Sedan',
    length: 4.2,
    width: 1.9,
    height: 1.35,
    maxSpeed: 16.0,       // m/s (~58 km/h)
    maxAcceleration: 2.8, // m/s²
    comfortableDecel: 3.2,
    timeHeadway: 1.4,     // seconds
    minGap: 2.4,          // meters
    weight: 1.0,
  },

  VAN: {
    id: 'van',
    name: 'Delivery Van',
    length: 5.5,
    width: 2.1,
    height: 1.8,
    maxSpeed: 14.0,       // m/s (~50 km/h)
    maxAcceleration: 2.2,
    comfortableDecel: 2.8,
    timeHeadway: 1.6,
    minGap: 2.8,
    weight: 0.25,
  },

  BUS: {
    id: 'bus',
    name: 'City Bus',
    length: 10.0,
    width: 2.5,
    height: 2.8,
    maxSpeed: 12.0,       // m/s (~43 km/h)
    maxAcceleration: 1.6,
    comfortableDecel: 2.4,
    timeHeadway: 2.0,
    minGap: 3.5,
    weight: 0.1,
  },
};
