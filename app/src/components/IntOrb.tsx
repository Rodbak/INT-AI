import { useEffect, useState } from 'react';
import './IntOrb.css';

/**
 * A small living "presence" for INT in the Home header: a soft violet orb that
 * breathes gently, and gives a stronger "stir" pulse when fresh nudges land
 * (ProactiveFeed dispatches an `int:nudges` event with the count).
 */
export default function IntOrb() {
  const [stir, setStir] = useState(false);

  useEffect(() => {
    const onNudge = (e: Event) => {
      const count = (e as CustomEvent).detail?.count ?? 0;
      if (count > 0) {
        setStir(true);
        const t = setTimeout(() => setStir(false), 1500);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener('int:nudges', onNudge as EventListener);
    return () => window.removeEventListener('int:nudges', onNudge as EventListener);
  }, []);

  return (
    <span className={`intorb${stir ? ' intorb--stir' : ''}`} aria-hidden>
      <span className="intorb__core" />
    </span>
  );
}
