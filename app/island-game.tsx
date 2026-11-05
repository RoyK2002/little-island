'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Coins, Compass, RotateCcw, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';

type GameHandle = { reset: () => void; setInput: (key: string, down: boolean) => void; destroy: () => void };
export default function IslandGame() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<GameHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [coins, setCoins] = useState(0);
  const [region, setRegion] = useState('Sunny shore');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('./world.mjs').then(({ createWorld }) => {
      if (cancelled || !host.current) return;
      game.current = createWorld(host.current, { onCoins: setCoins, onRegion: setRegion, onNotice: setNotice, onError: setError });
      setReady(true);
    }).catch(() => setError('The island could not load. Please reload to try again.'));
    return () => { cancelled = true; game.current?.destroy(); game.current = null; };
  }, []);
  const reset = () => { game.current?.reset(); host.current?.querySelector('canvas')?.focus(); };
  return (
    <main className="island-app">
      <div ref={host} className="world" aria-label="Little Island 3D game" />
      <header className="game-header">
        <div className="brand"><span className="brand-icon"><Waves aria-hidden="true" /></span><div><h1>little island<span className="brand-dot">.</span></h1><p>A place to wander</p></div></div>
        <div className="header-actions">
          <div className="coin-count" aria-label={`${coins} of 12 coins collected`}><Coins aria-hidden="true" /><strong>{coins}<span> / 12</span></strong><span className="coin-label">found</span></div>
          <Button variant="outline" onClick={reset} disabled={!ready || !!error} className="reset-button"><RotateCcw aria-hidden="true" /><span>Reset island</span></Button>
        </div>
      </header>
      {!ready && !error && <div className="loading-island" role="status"><Waves /><p>Arriving on the island…</p></div>}
      {error && <div className="loading-island error-panel" role="alert"><h2>Let’s try that again</h2><p>{error}</p><Button onClick={() => window.location.reload()}>Reload island</Button></div>}
      {ready && !error && <>
        <div className="location"><Compass aria-hidden="true" /><span>{region}</span></div>
        <div className={`game-notice ${notice ? 'shown' : ''}`} role="status">{notice}</div>
        <aside className="wander-note"><span className="eyebrow">YOUR LITTLE GETAWAY</span><h2>Nowhere to rush.</h2><p>Follow the shore or find all 12 coins.<br />The island is yours to explore.</p></aside>
        <footer className="controls-bar">
          <div className="keyboard-controls"><div className="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><span>or arrow keys to move</span><span className="control-divider" /><kbd>Shift</kbd><span>to jog</span><span className="control-divider" /><kbd>R</kbd><span>to reset</span></div>
          <span className="pace-note"><span />No timer. Just explore.</span>
        </footer>
        <div className="touch-controls" aria-label="Touch movement controls">{[
          ['up', 'ArrowUp', ArrowUp], ['left', 'ArrowLeft', ArrowLeft], ['down', 'ArrowDown', ArrowDown], ['right', 'ArrowRight', ArrowRight],
        ].map(([position, key, Icon]) => { const ArrowIcon = Icon as typeof ArrowUp; return <Button key={key as string} aria-label={`Move ${position}`} className={`touch-key touch-${position}`} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); game.current?.setInput(key as string, true); }} onPointerUp={() => game.current?.setInput(key as string, false)} onPointerCancel={() => game.current?.setInput(key as string, false)} onLostPointerCapture={() => game.current?.setInput(key as string, false)}><ArrowIcon /></Button>; })}</div>
        <div className="sr-only" aria-live="polite">{coins === 12 ? 'All coins found! Keep exploring or reset the island.' : ''}</div>
      </>}
    </main>
  );
}
