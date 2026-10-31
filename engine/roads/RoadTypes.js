/**
 * RoadTypes.js — Specifications for all road types in Game City.
 * Inspired by Trafficity: clean vector aesthetic, distinct lane layouts,
 * elevation bridge decks, and custom speeds.
 */

export const ROAD_TYPES = {
  LOCAL: {
    id: 'local',
    name: 'Local Road',
    description: '2 lanes (1 each direction). Standard city street.',
    lanesTotal: 2,
    lanesForward: 1,
    lanesBackward: 1,
    laneWidth: 4.5,
    totalWidth: 9.0,
    speedLimit: 50, // km/h
    surfaceColor: 0xffffff,
    borderColor: 0x334155, // dark slate border
    borderWidth: 0.35,
    hasCenterLine: true,
    centerLineColor: 0xf59e0b, // amber/yellow
    hasLaneDividers: false,
    costPerMeter: 20,
    maxGrade: 0.15, // max slope for bridge ramps
    bridgePillarSpacing: 30,
  },

  AVENUE: {
    id: 'avenue',
    name: 'Avenue',
    description: '4 lanes (2 each direction). High-capacity urban road.',
    lanesTotal: 4,
    lanesForward: 2,
    lanesBackward: 2,
    laneWidth: 4.2,
    totalWidth: 17.5,
    speedLimit: 70,
    surfaceColor: 0xffffff,
    borderColor: 0x334155,
    borderWidth: 0.45,
    hasCenterLine: true,
    centerLineColor: 0xf59e0b,
    hasLaneDividers: true,
    laneDividerColor: 0x94a3b8, // dashed white/light slate
    costPerMeter: 45,
    maxGrade: 0.12,
    bridgePillarSpacing: 35,
  },

  HIGHWAY: {
    id: 'highway',
    name: 'Highway',
    description: '6 lanes (3 each direction) with central barrier. Fast transit.',
    lanesTotal: 6,
    lanesForward: 3,
    lanesBackward: 3,
    laneWidth: 4.5,
    totalWidth: 28.0,
    speedLimit: 110,
    surfaceColor: 0xffffff,
    borderColor: 0x1e293b,
    borderWidth: 0.6,
    hasCenterLine: true,
    centerLineColor: 0xe2e8f0, // concrete barrier / median
    hasLaneDividers: true,
    laneDividerColor: 0x94a3b8,
    costPerMeter: 80,
    maxGrade: 0.08,
    bridgePillarSpacing: 40,
  },

  RAMP: {
    id: 'ramp',
    name: 'Highway Ramp',
    description: '1 lane one-way connecting curve for interchanges.',
    lanesTotal: 1,
    lanesForward: 1,
    lanesBackward: 0,
    laneWidth: 5.5,
    totalWidth: 6.0,
    speedLimit: 60,
    surfaceColor: 0xffffff,
    borderColor: 0x334155,
    borderWidth: 0.35,
    hasCenterLine: false,
    hasLaneDividers: false,
    costPerMeter: 25,
    maxGrade: 0.15,
    bridgePillarSpacing: 25,
  },

  ROUNDABOUT: {
    id: 'roundabout',
    name: 'Roundabout',
    description: 'Circular intersection with circulating priority.',
    lanesTotal: 2,
    lanesForward: 2,
    lanesBackward: 0,
    laneWidth: 5.0,
    totalWidth: 10.0,
    radius: 22.0, // default outer radius
    speedLimit: 40,
    surfaceColor: 0xffffff,
    borderColor: 0x334155,
    borderWidth: 0.4,
    hasCenterLine: false,
    hasLaneDividers: true,
    laneDividerColor: 0x94a3b8,
    costPerMeter: 50,
  },
};

export const ELEVATION_LEVELS = {
  GROUND: 0,
  BRIDGE: 8, // 8 metres height clearance
  HIGH_BRIDGE: 16, // multi-level interchange
};

