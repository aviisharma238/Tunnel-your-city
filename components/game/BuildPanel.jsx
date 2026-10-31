'use client';

import { useGameStore } from '@/stores/gameStore';
import { useBuildStore } from '@/stores/buildStore';
import { gameEngine } from '@/engine/core/GameEngine';
import { ROAD_TYPES, ELEVATION_LEVELS } from '@/engine/roads/RoadTypes';
import { Undo2, Redo2, Circle, Layers, Minus, TrendingUp } from 'lucide-react';
import styles from './BuildPanel.module.css';

const ROAD_OPTIONS = [
  { key: 'LOCAL', name: 'Local Road', desc: '2 Lanes · 50 km/h · 9m', badge: '2L' },
  { key: 'AVENUE', name: 'Avenue', desc: '4 Lanes · 70 km/h · 17.5m', badge: '4L' },
  { key: 'HIGHWAY', name: 'Highway', desc: '6 Lanes · 110 km/h · 28m', badge: '6L' },
  { key: 'RAMP', name: 'Highway Ramp', desc: '1 Lane · One-Way · 6m', badge: '1L' },
];

export default function BuildPanel() {
  const activeTool = useGameStore(s => s.activeTool);
  const roadType = useBuildStore(s => s.roadType);
  const setRoadType = useBuildStore(s => s.setRoadType);
  const buildMode = useBuildStore(s => s.buildMode);
  const setBuildMode = useBuildStore(s => s.setBuildMode);
  const elevation = useBuildStore(s => s.elevation);
  const setElevation = useBuildStore(s => s.setElevation);
  const showControlPoints = useBuildStore(s => s.showControlPoints);
  const toggleControlPoints = useBuildStore(s => s.toggleControlPoints);

  if (activeTool !== 'road' && activeTool !== 'demolish') {
    return null;
  }

  const handleSelectRoadType = (key) => {
    setRoadType(key);
    gameEngine.roadBuilder?.setRoadType(key);
    if (buildMode === 'roundabout') {
      setBuildMode('curved');
      gameEngine.roadBuilder?.setBuildMode('curved');
    }
  };

  const handleSelectMode = (mode) => {
    setBuildMode(mode);
    gameEngine.roadBuilder?.setBuildMode(mode);
  };

  const handleSetElevation = (elev) => {
    setElevation(elev);
    gameEngine.roadBuilder?.setElevation(elev);
  };

  const handleUndo = () => {
    gameEngine.roadNetwork?.undo();
  };

  const handleRedo = () => {
    gameEngine.roadNetwork?.redo();
  };

  const handleToggleHandles = () => {
    toggleControlPoints();
    if (gameEngine.roadRenderer) {
      gameEngine.roadRenderer.showControlPoints = !showControlPoints;
      gameEngine.roadRenderer._updateControlPoints();
    }
  };

  if (activeTool === 'demolish') {
    return (
      <div className={styles.demolishPanel}>
        <div className={styles.demolishHeader}>
          <span className={styles.demolishDot} />
          <strong>Demolish Tool Active</strong>
        </div>
        <p className={styles.demolishText}>
          Hover over any road segment, intersection, or building to highlight it in red. Click to remove it.
        </p>
        <button
          className={styles.cancelBtn}
          onClick={() => useGameStore.getState().setActiveTool('road')}
        >
          Return to Road Tool [R]
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.category}>ROAD CONSTRUCTION</span>
          <span className={styles.subtitle}>Trafficity Bézier Engine</span>
        </div>

        {/* Undo / Redo */}
        <div className={styles.historyGroup}>
          <button className={styles.iconBtn} onClick={handleUndo} title="Undo [Ctrl+Z]">
            <Undo2 size={15} />
          </button>
          <button className={styles.iconBtn} onClick={handleRedo} title="Redo [Ctrl+Shift+Z]">
            <Redo2 size={15} />
          </button>
        </div>
      </div>

      {/* Road Types Palette */}
      <div className={styles.typeList}>
        {ROAD_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`${styles.typeBtn} ${roadType === opt.key && buildMode !== 'roundabout' ? styles.active : ''}`}
            onClick={() => handleSelectRoadType(opt.key)}
          >
            <div className={styles.badge}>{opt.badge}</div>
            <div className={styles.typeInfo}>
              <span className={styles.typeName}>{opt.name}</span>
              <span className={styles.typeDesc}>{opt.desc}</span>
            </div>
          </button>
        ))}

        {/* Roundabout Preset Button */}
        <button
          className={`${styles.typeBtn} ${buildMode === 'roundabout' ? styles.active : ''}`}
          onClick={() => handleSelectMode('roundabout')}
        >
          <div className={styles.badge}>⭕</div>
          <div className={styles.typeInfo}>
            <span className={styles.typeName}>Roundabout</span>
            <span className={styles.typeDesc}>4-Way 2-Lane Ring · 44m</span>
          </div>
        </button>
      </div>

      {/* Mode Controls: Curve vs Straight & Multi-Level Elevation */}
      <div className={styles.controlsRow}>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.pillBtn} ${buildMode === 'curved' ? styles.pillActive : ''}`}
            onClick={() => handleSelectMode('curved')}
            title="Smooth Bézier Curve"
          >
            <TrendingUp size={14} />
            <span>Curved</span>
          </button>
          <button
            className={`${styles.pillBtn} ${buildMode === 'straight' ? styles.pillActive : ''}`}
            onClick={() => handleSelectMode('straight')}
            title="Straight Segment"
          >
            <Minus size={14} />
            <span>Straight</span>
          </button>
        </div>

        {/* Multi-tier Elevation Selector (Ground, Bridge L1, Bridge L2) */}
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.pillBtn} ${elevation === 0 ? styles.pillActive : ''}`}
            onClick={() => handleSetElevation(0)}
            title="Ground Level (0m)"
          >
            <span>0m</span>
          </button>
          <button
            className={`${styles.pillBtn} ${elevation === ELEVATION_LEVELS.BRIDGE ? styles.pillActive : ''}`}
            onClick={() => handleSetElevation(ELEVATION_LEVELS.BRIDGE)}
            title="Bridge Level 1 (+8m) [E]"
          >
            <Layers size={13} />
            <span>+8m</span>
          </button>
          <button
            className={`${styles.pillBtn} ${elevation === ELEVATION_LEVELS.HIGH_BRIDGE ? styles.pillActive : ''}`}
            onClick={() => handleSetElevation(ELEVATION_LEVELS.HIGH_BRIDGE)}
            title="High Flyover Level 2 (+16m)"
          >
            <Layers size={13} />
            <span>+16m</span>
          </button>
        </div>
      </div>

      {/* Footer tips */}
      <div className={styles.footer}>
        <div className={styles.tips}>
          <span>💡 <strong>Click & drag black dots</strong> to bend curves · <strong>E</strong> toggle elevation · <strong>H</strong> heatmap</span>
        </div>
        <button
          className={`${styles.handleToggle} ${showControlPoints ? styles.handleToggleActive : ''}`}
          onClick={handleToggleHandles}
          title="Toggle Control Point Dots"
        >
          <Circle size={10} fill={showControlPoints ? '#38bdf8' : 'none'} />
          <span>Nodes</span>
        </button>
      </div>
    </div>
  );
}

