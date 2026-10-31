'use client';

/**
 * GameCanvas — mounts the React Three Fiber canvas and initialises the game engine.
 *
 * Architecture:
 *  - R3F drives rendering at 60fps via its own RAF (frameloop="always")
 *  - useFrame() calls gameEngine.renderFrame() each render tick (camera, env updates)
 *  - GameLoop runs a separate fixed 20Hz simulation tick (no rendering)
 *  - React state is only updated via EventBus — never per-frame
 */

import { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { gameEngine } from '@/engine/core/GameEngine';
import { eventBus, EVENTS } from '@/engine/core/EventBus';
import { useGameStore } from '@/stores/gameStore';
import GameHUD from './GameHUD';
import styles from './GameCanvas.module.css';

/** Inner R3F component — has access to Three.js context via hooks */
function EngineMount() {
  const { scene, gl, camera } = useThree();
  const setEngineReady = useGameStore(s => s.setEngineReady);
  const setStats = useGameStore(s => s.setStats);
  const initialized = useRef(false);

  // One-time engine initialization
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    gameEngine.init(scene, gl, camera).then(() => {
      setEngineReady(true);
    });

    // Bridge engine events → Zustand (only for UI-relevant updates)
    const unsubs = [
      eventBus.on(EVENTS.STATS_UPDATED, (data) => setStats(data)),
      eventBus.on(EVENTS.GAME_PAUSED,   () => useGameStore.getState().setPaused(true)),
      eventBus.on(EVENTS.GAME_RESUMED,  () => useGameStore.getState().setPaused(false)),
      eventBus.on(EVENTS.GAME_SPEED_CHANGED, (v) => useGameStore.getState().setSpeedMultiplier(v)),
    ];

    return () => {
      unsubs.forEach(fn => fn());
      gameEngine.destroy();
      initialized.current = false;
    };
  }, [scene, gl, camera, setEngineReady, setStats]);

  // 60fps render hook — engine updates camera + environment each frame
  useFrame((_, delta) => {
    gameEngine.renderFrame(delta);
  });

  // No JSX output — engine manages scene objects directly via Three.js
  return null;
}

export default function GameCanvas() {
  return (
    <div className={styles.container}>
      <Canvas
        className={styles.canvas}
        camera={{
          fov: 60,
          near: 0.5,
          far: 3000,
          position: [0, 120, 180],
        }}
        shadows
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        frameloop="always"
      >
        <EngineMount />
      </Canvas>
      <GameHUD />
    </div>
  );
}
