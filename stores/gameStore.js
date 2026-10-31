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
  setStats: ({ fps, simTime, vehicleCount }) => set(s => ({
    fps: fps ?? s.fps,
    simTime: simTime ?? s.simTime,
    vehicleCount: vehicleCount ?? s.vehicleCount,
  })),

  // ── HUD visibility ────────────────────────────────────────
  showGrid: true,
  showDebug: true,
  showStats: true,
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleDebug: () => set(s => ({ showDebug: !s.showDebug })),
}));
