'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '24px'
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Settings</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Coming in Phase 8</p>
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        color: 'var(--color-accent)', textDecoration: 'none'
      }}>
        <ArrowLeft size={16} /> Back to Menu
      </Link>
    </div>
  );
}
