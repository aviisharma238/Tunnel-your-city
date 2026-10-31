'use client';

import dynamic from 'next/dynamic';

// Dynamic import — Three.js cannot run during SSR
const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0e1a', color: '#94a3b8', fontSize: '1rem',
      letterSpacing: '0.2em', textTransform: 'uppercase'
    }}>
      Loading Engine…
    </div>
  ),
});

export default function GamePage() {
  return <GameCanvas />;
}
