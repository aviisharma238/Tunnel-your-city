/**
 * gameStore — Zustand store for top-level game UI state.
 * The engine never imports from this store.
 * React components read from it; the EventBus writes to it.
 */

import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // ── Lifecycle ─────────────────────────────────────────────
  isEngineReady: false,
  isPaused: false,
  speedMultiplier: 1,

  setEngineReady: () => set({ isEngineReady: true }),
  setPaused: (v) => set({ isPaused: v }),
  setSpeedMultiplier: (v) => set({ speedMultiplier: v }),

  // ── Active tool ──────────────────────────────────────────
  activeTool: 'select',  // 'select' | 'road' | 'zone' | 'building' | 'demolish'
  setActiveTool: (tool) => set({ activeTool: tool }),

  // ── Camera mode ──────────────────────────────────────────
  cameraMode: 'free',    // 'free' | 'topdown' | 'street'
  setCameraMode: (mode) => set({ cameraMode: mode }),

  // ── Stats (updated by EventBus from engine) ───────────────
  fps: 0,
  simTime: 0,
  vehicleCount: 0,
  avgSpeed: 0,
  congestion: 0,
  setStats: (data) => set(s => ({
    fps: data.fps ?? s.fps,
    simTime: data.simTime ?? s.simTime,
    vehicleCount: data.vehicleCount ?? s.vehicleCount,
    avgSpeed: data.avgSpeed ?? s.avgSpeed,
    congestion: data.congestion ?? s.congestion,
  })),

  // ── HUD visibility ────────────────────────────────────────
  showGrid: true,
  showDebug: true,
  showStats: true,
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleDebug: () => set(s => ({ showDebug: !s.showDebug })),
}));
