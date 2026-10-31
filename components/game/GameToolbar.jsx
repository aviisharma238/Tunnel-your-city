'use client';

import { useState, useEffect } from 'react';
import { MousePointer2, Route, Building2, Paintbrush, Trash2, Eye, Flame } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { gameEngine } from '@/engine/core/GameEngine';
import styles from './GameToolbar.module.css';

const TOOLS = [
  { id: 'select',   icon: MousePointer2, label: 'Select',   shortcut: 'Q' },
  { id: 'road',     icon: Route,         label: 'Road',     shortcut: 'R' },
  { id: 'demolish', icon: Trash2,        label: 'Demolish', shortcut: 'X' },
  { id: 'zone',     icon: Paintbrush,    label: 'Zone',     shortcut: 'Z' },
  { id: 'building', icon: Building2,     label: 'Building', shortcut: 'B' },
];

const CAMERA_MODES = [
  { id: 'topdown', label: 'Top',   shortcut: '1' },
  { id: 'free',    label: 'Free',  shortcut: '2' },
  { id: 'street',  label: 'Street',shortcut: '3' },
];

export default function GameToolbar() {
  const activeTool = useGameStore(s => s.activeTool);
  const setActiveTool = useGameStore(s => s.setActiveTool);
  const cameraMode = useGameStore(s => s.cameraMode);
  const setCameraMode = useGameStore(s => s.setCameraMode);

  const [heatmapActive, setHeatmapActive] = useState(false);

  const handleSelectTool = (toolId) => {
    setActiveTool(toolId);
    gameEngine.roadBuilder?.setTool(toolId);
  };

  const handleCameraMode = (mode) => {
    setCameraMode(mode);
    gameEngine.cameraController?.setMode(mode);
  };

  const handleToggleHeatmap = () => {
    const isVis = gameEngine.toggleHeatmap();
    setHeatmapActive(isVis);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'q' || e.key === 'Q') handleSelectTool('select');
      else if (e.key === 'r' || e.key === 'R') handleSelectTool('road');
      else if (e.key === 'x' || e.key === 'X') handleSelectTool('demolish');
      else if (e.key === 'h' || e.key === 'H') handleToggleHeatmap();
      else if (e.key === '1') handleCameraMode('topdown');
      else if (e.key === '2') handleCameraMode('free');
      else if (e.key === '3') handleCameraMode('street');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.toolbar}>
      {/* Build tools */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Tools</span>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`${styles.btn} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => handleSelectTool(tool.id)}
            title={`${tool.label} [${tool.shortcut}]`}
          >
            <tool.icon size={18} />
            <span className={styles.btnLabel}>{tool.label}</span>
            <kbd className={styles.kbd}>{tool.shortcut}</kbd>
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      {/* Traffic & Heatmap Analysis (image copy 5.png) */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Analysis</span>
        <button
          className={`${styles.btn} ${heatmapActive ? styles.active : ''}`}
          onClick={handleToggleHeatmap}
          title="Toggle Congestion / Noise Heatmap [H]"
        >
          <Flame size={18} color={heatmapActive ? '#ef4444' : 'currentColor'} />
          <span className={styles.btnLabel}>Heatmap</span>
          <kbd className={styles.kbd}>H</kbd>
        </button>
      </div>

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
