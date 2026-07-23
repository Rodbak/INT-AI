import { useEffect, useRef, useState } from 'react';

// Animate a number from its previous value up to `target` with an ease-out.
// Honours prefers-reduced-motion by jumping straight to the value. Starts from
// 0 on first mount so KPIs count up when the page loads.
export function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    if (reduce || from === target) { setVal(target); fromRef.current = target; return; }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { fromRef.current = target; setVal(target); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return val;
}
