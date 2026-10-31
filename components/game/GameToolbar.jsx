'use client';

import { MousePointer2, Route, Building2, Paintbrush, Trash2, Eye } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { gameEngine } from '@/engine/core/GameEngine';
import styles from './GameToolbar.module.css';

const TOOLS = [
  { id: 'select',   icon: MousePointer2, label: 'Select',   shortcut: 'Q' },
  { id: 'road',     icon: Route,        label: 'Road',     shortcut: 'R' },
  { id: 'zone',     icon: Paintbrush,    label: 'Zone',     shortcut: 'Z' },
  { id: 'building', icon: Building2,     label: 'Building', shortcut: 'B' },
  { id: 'demolish', icon: Trash2,        label: 'Demolish', shortcut: 'X' },
];

const CAMERA_MODES = [
  { id: 'free',    label: 'Free',  shortcut: '1' },
  { id: 'topdown', label: 'Top',   shortcut: '2' },
  { id: 'street',  label: 'Street',shortcut: '3' },
];

export default function GameToolbar() {
  const activeTool = useGameStore(s => s.activeTool);
  const setActiveTool = useGameStore(s => s.setActiveTool);
  const cameraMode = useGameStore(s => s.cameraMode);
  const setCameraMode = useGameStore(s => s.setCameraMode);
  const toggleGrid = useGameStore(s => s.toggleGrid);
  const showGrid = useGameStore(s => s.showGrid);

  const handleCameraMode = (mode) => {
    setCameraMode(mode);
    gameEngine.cameraController?.setMode(mode);
    gameEngine.terrain?.setGridVisible(mode !== 'street');
  };

  return (
    <div className={styles.toolbar}>
      {/* Build tools */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Tools</span>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`${styles.btn} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.label} [${tool.shortcut}]`}
          >
            <tool.icon size={18} />
            <span className={styles.btnLabel}>{tool.label}</span>
            <kbd className={styles.kbd}>{tool.shortcut}</kbd>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Camera modes */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Camera</span>
        {CAMERA_MODES.map(m => (
          <button
            key={m.id}
            className={`${styles.btn} ${cameraMode === m.id ? styles.active : ''}`}
            onClick={() => handleCameraMode(m.id)}
            title={`${m.label} view [${m.shortcut}]`}
          >
            <Eye size={18} />
            <span className={styles.btnLabel}>{m.label}</span>
            <kbd className={styles.kbd}>{m.shortcut}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
