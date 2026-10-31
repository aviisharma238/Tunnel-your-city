/**
 * EventBus — lightweight pub/sub for engine ↔ UI communication.
 * The game engine fires events; React components subscribe to them.
 * This keeps the engine completely decoupled from React.
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /** Unsubscribe a specific callback. */
  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  /** Emit an event with optional payload. */
  emit(event, payload) {
    this._listeners.get(event)?.forEach(cb => {
      try { cb(payload); } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /** Remove all listeners for an event. */
  clear(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }
}

// Singleton — one bus for the whole game
export const eventBus = new EventBus();

/** Canonical event names to avoid typos */
export const EVENTS = {
  // Engine lifecycle
  ENGINE_READY: 'engine:ready',
  ENGINE_TICK: 'engine:tick',

  // Game state
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_SPEED_CHANGED: 'game:speedChanged',

  // Road events
  ROAD_ADDED: 'road:added',
  ROAD_REMOVED: 'road:removed',
  ROAD_UPDATED: 'road:updated',

  // Vehicle events
  VEHICLE_SPAWNED: 'vehicle:spawned',
  VEHICLE_DESTROYED: 'vehicle:destroyed',
  TRAFFIC_UPDATED: 'traffic:updated',

  // Camera
  CAMERA_MODE_CHANGED: 'camera:modeChanged',

  // Stats
  STATS_UPDATED: 'stats:updated',
};
