'use client';

import { Pause, Play, ArrowLeft, Car, RefreshCw } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { gameEngine } from '@/engine/core/GameEngine';
import Link from 'next/link';
import styles from './TimeControls.module.css';

const SPEEDS = [
  { multiplier: 1,  label: '1×' },
  { multiplier: 2,  label: '2×' },
  { multiplier: 5,  label: '5×' },
];

export default function TimeControls() {
  const isPaused = useGameStore(s => s.isPaused);
  const speed = useGameStore(s => s.speedMultiplier);
  const setSpeed = useGameStore(s => s.setSpeedMultiplier);

  const handlePause = () => {
    if (isPaused) {
      gameEngine.resume();
    } else {
      gameEngine.pause();
    }
  };

  const handleSpeed = (mult) => {
    setSpeed(mult);
    gameEngine.setSpeed(mult);
    if (isPaused) gameEngine.resume();
  };

  const handleSpawnCars = () => {
    gameEngine.vehicleManager?.spawnBatch(10);
  };

  const handleClearCars = () => {
    gameEngine.vehicleManager?.clearAll();
  };

  return (
    <div className={styles.bar}>
      {/* Back to menu */}
      <Link href="/" className={styles.backBtn} title="Back to Menu">
        <ArrowLeft size={14} />
      </Link>

      <div className={styles.divider} />

      {/* Pause / Play */}
      <button className={styles.pauseBtn} onClick={handlePause} title="Pause / Resume [Space]">
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      {/* Speed Multipliers */}
      {SPEEDS.map(s => (
        <button
          key={s.multiplier}
          className={`${styles.speedBtn} ${speed === s.multiplier && !isPaused ? styles.active : ''}`}
          onClick={() => handleSpeed(s.multiplier)}
          title={`Simulation Speed ${s.label}`}
        >
          {s.label}
        </button>
      ))}

      <div className={styles.divider} />

      {/* Quick Traffic Controls */}
      <button
        className={styles.spawnBtn}
        onClick={handleSpawnCars}
        title="Spawn 10 Cars"
      >
        <Car size={15} />
        <span>+10</span>
      </button>

      <button
        className={styles.iconBtn}
        onClick={handleClearCars}
        title="Clear Traffic"
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
