/**
 * settingsStore — graphics and gameplay preferences.
 */

import { create } from 'zustand';

export const useSettingsStore = create((set) => ({
  shadowQuality: 'medium',    // 'low' | 'medium' | 'high'
  drawDistance: 800,
  setShadowQuality: (q) => set({ shadowQuality: q }),
  setDrawDistance: (d) => set({ drawDistance: d }),
}));
