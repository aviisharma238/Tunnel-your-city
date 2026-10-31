'use client';

import Link from 'next/link';
import { Play, Settings, Map, Info } from 'lucide-react';
import styles from './page.module.css';

export default function MainMenu() {
  return (
    <div className={styles.container}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <div className={styles.logo}>
          <h1 className={styles.title}>GAME CITY</h1>
          <p className={styles.subtitle}>3D Traffic & City Simulator</p>
        </div>

        <nav className={styles.menu}>
          <Link href="/game" className={styles.menuBtn}>
            <Play size={20} />
            <span>New Game</span>
          </Link>
          <button className={styles.menuBtn} disabled>
            <Map size={20} />
            <span>Load Game</span>
          </button>
          <Link href="/settings" className={styles.menuBtn}>
            <Settings size={20} />
            <span>Settings</span>
          </Link>
          <button className={styles.menuBtn} disabled>
            <Info size={20} />
            <span>About</span>
          </button>
        </nav>

        <footer className={styles.footer}>
          <span>Phase 1 — 3D Foundation</span>
        </footer>
      </div>
    </div>
  );
}
