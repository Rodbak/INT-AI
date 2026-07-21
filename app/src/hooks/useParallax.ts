import { useEffect } from 'react';

/**
 * Publishes an eased, normalized pointer position as CSS custom properties
 * (--mx / --my, each roughly -1..1) on the document root. Any element can then
 * translate/tilt by a multiple of these to sit at a different apparent depth —
 * the basis of the spatial-depth look. Runs on rAF and idles when still.
 */
export function useParallax() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      root.style.setProperty('--mx', cx.toFixed(4));
      root.style.setProperty('--my', cy.toFixed(4));
      if (Math.abs(tx - cx) > 0.0006 || Math.abs(ty - cy) > 0.0006) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
