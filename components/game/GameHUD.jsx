'use client';

import { useGameStore } from '@/stores/gameStore';
import GameToolbar from './GameToolbar';
import TimeControls from './TimeControls';
import StatsPanel from './StatsPanel';
import styles from './GameHUD.module.css';

export default function GameHUD() {
  const isEngineReady = useGameStore(s => s.isEngineReady);

  if (!isEngineReady) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Initializing Engine…</span>
      </div>
    );
  }

  return (
    <div className={styles.hud}>
      <GameToolbar />
      <TimeControls />
      <StatsPanel />
    </div>
  );
}
