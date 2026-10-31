'use client';

import { useGameStore } from '@/stores/gameStore';
import styles from './StatsPanel.module.css';

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function StatsPanel() {
  const showStats = useGameStore(s => s.showStats);
  const fps = useGameStore(s => s.fps);
  const simTime = useGameStore(s => s.simTime);
  const vehicleCount = useGameStore(s => s.vehicleCount);
  const speed = useGameStore(s => s.speedMultiplier);
  const isPaused = useGameStore(s => s.isPaused);

  if (!showStats) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>FPS</span>
        <span className={`${styles.value} ${fps < 30 ? styles.warn : fps >= 55 ? styles.good : ''}`}>
          {fps}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Sim</span>
        <span className={styles.value}>{isPaused ? '⏸' : `${speed}×`}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Time</span>
        <span className={styles.value}>{formatTime(simTime)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Vehicles</span>
        <span className={styles.value}>{vehicleCount}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Phase</span>
        <span className={styles.value} style={{ color: 'var(--color-accent)' }}>1 / 8</span>
      </div>
    </div>
  );
}
