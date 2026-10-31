/**
 * buildStore — Zustand store for build-mode state.
 * Road type, zone selection, building palette.
 * buildStore — Zustand store for road building, palette, and mode options.
 */

import { create } from 'zustand';

export const useBuildStore = create((set) => ({
  // Road settings
  roadType: 'local',          // 'local' | 'arterial' | 'highway'
  laneCount: 2,               // lanes per direction
  roadType: 'LOCAL',             // 'LOCAL' | 'AVENUE' | 'HIGHWAY' | 'RAMP'
  buildMode: 'curved',           // 'curved' | 'straight' | 'roundabout'
  elevation: 0,                  // 0 (Ground) | 8 (Bridge) | 16 (High Bridge)
  showControlPoints: true,

  setRoadType: (t) => set({ roadType: t }),
  setLaneCount: (n) => set({ laneCount: n }),
  setBuildMode: (m) => set({ buildMode: m }),
  setElevation: (e) => set({ elevation: e }),
  toggleElevation: () => set(s => ({ elevation: s.elevation === 0 ? 8 : 0 })),
  toggleControlPoints: () => set(s => ({ showControlPoints: !s.showControlPoints })),

  // Zone type
  zoneType: 'residential',    // 'residential' | 'commercial' | 'industrial'
  // Zone type (for Phase 5)
  zoneType: 'residential',
  setZoneType: (z) => set({ zoneType: z }),
}));
