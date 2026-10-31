/**
 * GameLoop — decoupled fixed-step simulation + variable render tick.
 *
 * Simulation runs at a fixed SIM_HZ (20 Hz by default).
 * Rendering runs at the display refresh rate via requestAnimationFrame.
 * This keeps the simulation deterministic regardless of frame rate.
 */

import { eventBus, EVENTS } from './EventBus.js';

const SIM_HZ = 20;
const SIM_STEP_MS = 1000 / SIM_HZ; // 50ms per sim tick
const MAX_CATCH_UP_STEPS = 5;       // prevent spiral of death

export class GameLoop {
  constructor() {
    this._rafId = null;
    this._lastTimestamp = 0;
    this._accumulator = 0;
    this._simTime = 0;         // total sim time in ms
    this._frameCount = 0;
    this._fps = 0;
    this._fpsTimer = 0;
    this._fpsFrames = 0;
    this._running = false;
    this._speedMultiplier = 1;

    // Callbacks registered by engine systems
    this._simCallbacks = [];   // (dt: seconds) => void
    this._renderCallbacks = []; // (alpha: number, dt: ms) => void
  }

  /** Register a function to be called on each simulation step. */
  onSimTick(fn) {
    this._simCallbacks.push(fn);
    return () => { this._simCallbacks = this._simCallbacks.filter(f => f !== fn); };
  }

  /** Register a function to be called on each render frame. */
  onRenderFrame(fn) {
    this._renderCallbacks.push(fn);
    return () => { this._renderCallbacks = this._renderCallbacks.filter(f => f !== fn); };
  }

  get isRunning() { return this._running; }
  get simTime() { return this._simTime; }
  get fps() { return this._fps; }

  set speedMultiplier(v) {
    this._speedMultiplier = Math.max(0, Math.min(v, 10));
    eventBus.emit(EVENTS.GAME_SPEED_CHANGED, this._speedMultiplier);
  }
  get speedMultiplier() { return this._speedMultiplier; }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTimestamp = performance.now();
    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }

  pause() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    eventBus.emit(EVENTS.GAME_PAUSED);
  }

  resume() {
    if (this._running) return;
    this._lastTimestamp = performance.now();
    this._accumulator = 0;
    this._running = true;
    this._rafId = requestAnimationFrame(this._tick.bind(this));
    eventBus.emit(EVENTS.GAME_RESUMED);
  }

  destroy() {
    this.pause();
    this._simCallbacks = [];
    this._renderCallbacks = [];
  }

  _tick(timestamp) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._tick.bind(this));

    const rawDelta = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;
    const delta = Math.min(rawDelta * this._speedMultiplier, SIM_STEP_MS * MAX_CATCH_UP_STEPS * 10);

    // Fixed-step simulation
    this._accumulator += delta;
    let steps = 0;
    while (this._accumulator >= SIM_STEP_MS && steps < MAX_CATCH_UP_STEPS) {
      const dtSeconds = SIM_STEP_MS / 1000;
      this._simCallbacks.forEach(fn => fn(dtSeconds));
      this._accumulator -= SIM_STEP_MS;
      this._simTime += SIM_STEP_MS;
      steps++;
      eventBus.emit(EVENTS.ENGINE_TICK, { simTime: this._simTime, dt: dtSeconds });
    }

    // Interpolation alpha for smooth rendering between steps
    const alpha = this._accumulator / SIM_STEP_MS;

    // Render frame
    this._renderCallbacks.forEach(fn => fn(alpha, rawDelta));

    // FPS tracking
    this._fpsFrames++;
    this._fpsTimer += rawDelta;
    if (this._fpsTimer >= 500) {
      this._fps = Math.round((this._fpsFrames / this._fpsTimer) * 1000);
      this._fpsFrames = 0;
      this._fpsTimer = 0;
      eventBus.emit(EVENTS.STATS_UPDATED, { fps: this._fps, simTime: this._simTime });
    }
  }
}
