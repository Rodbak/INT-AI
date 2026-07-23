// A tiny, dependency-free confetti burst for celebrating a win (e.g. a
// record sales day). Self-contained: draws to a throwaway full-screen canvas
// and cleans itself up. No-op when the user prefers reduced motion.
export function celebrate(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const colors = ['#8b5cf6', '#c4b5fd', '#22c55e', '#f59e0b', '#ec4899', '#38bdf8'];
  const N = Math.min(140, Math.round(W / 6));
  const parts = Array.from({ length: N }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -9 - 4,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[(Math.random() * colors.length) | 0],
  }));

  const start = performance.now();
  const DURATION = 2600;
  let raf = 0;
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.22; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < DURATION) raf = requestAnimationFrame(frame);
    else { cancelAnimationFrame(raf); canvas.remove(); }
  };
  raf = requestAnimationFrame(frame);
}
