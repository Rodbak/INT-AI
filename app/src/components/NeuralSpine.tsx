import { useEffect, useRef } from 'react';
import { neural, type TravelingSignal } from '../lib/neural';

/**
 * The Spine — the app's nervous system rendered as a living vertical column
 * docked in its own gutter, never behind text. The core sits at the top;
 * provider and specialist nodes branch off a central trunk; nerve impulses
 * travel down the trunk and fire outward along the branches when work happens.
 * Reads the same `neural` activity bus as the rest of the app.
 */

interface SpineNode {
  id?: string;
  y: number; // normalized 0..1 down the column
  kind: 'core' | 'provider' | 'specialist' | 'inter';
  branch: number; // how far the branch reaches right of the trunk (0..1 of width)
  r: number;
  phase: number;
}

const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'];
const SPECIALIST_SLOTS = 8;
const TRUNK_X = 0.4;

function hashToSlot(s: string, slots: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % slots;
}

export default function NeuralSpine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--rgb-accent').trim() || '62, 224, 255';
    const synapse = styles.getPropertyValue('--rgb-synapse').trim() || '169, 112, 255';
    const core = styles.getPropertyValue('--rgb-core').trim() || '120, 240, 255';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // --- build the spine once ---
    const nodes: SpineNode[] = [];
    const idIndex = new Map<string, number>();
    const push = (n: SpineNode) => {
      const i = nodes.length;
      nodes.push(n);
      if (n.id) idIndex.set(n.id, i);
      return i;
    };

    const coreIdx = push({ id: 'core', y: 0.06, kind: 'core', branch: 0, r: 6, phase: 0 });

    // Interleave providers and specialist slots down the trunk.
    const providerIdx: number[] = [];
    const specialistIdx: number[] = [];
    const order: ('p' | 's')[] = ['p', 's', 's', 'p', 's', 's', 'p', 's', 's', 'p', 's', 's'];
    let pi = 0;
    let si = 0;
    const top = 0.15;
    const bottom = 0.94;
    order.forEach((kind, k) => {
      const y = top + (bottom - top) * (k / (order.length - 1));
      if (kind === 'p' && pi < PROVIDERS.length) {
        providerIdx.push(
          push({
            id: `provider:${PROVIDERS[pi]}`,
            y,
            kind: 'provider',
            branch: 0.34 + (k % 2) * 0.08,
            r: 3.6,
            phase: Math.random() * 6.283,
          }),
        );
        pi++;
      } else if (si < SPECIALIST_SLOTS) {
        specialistIdx.push(
          push({
            id: `specialist:slot${si}`,
            y,
            kind: 'specialist',
            branch: 0.4 + (k % 2) * 0.1,
            r: 3.2,
            phase: Math.random() * 6.283,
          }),
        );
        si++;
      }
    });

    // Interneuron flecks scattered near the trunk for organic texture.
    for (let i = 0; i < 22; i++) {
      push({
        y: 0.1 + Math.random() * 0.85,
        kind: 'inter',
        branch: (Math.random() - 0.35) * 0.5,
        r: 1 + Math.random() * 1.4,
        phase: Math.random() * 6.283,
      });
    }

    const resolve = (id: string): number | undefined => {
      if (idIndex.has(id)) return idIndex.get(id);
      if (id.startsWith('specialist:')) return specialistIdx[hashToSlot(id, SPECIALIST_SLOTS)];
      if (id === 'core') return coreIdx;
      return undefined;
    };

    let W = 0;
    let H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Point on the trunk / at a node tip.
    const trunkPt = (n: SpineNode) => ({ x: TRUNK_X * W, y: n.y * H });
    const tipPt = (n: SpineNode) => ({ x: (TRUNK_X + n.branch) * W, y: n.y * H });

    // Position of a signal travelling core -> node: down the trunk, then out
    // the branch (an L-shaped nerve impulse).
    const signalPt = (from: SpineNode, to: SpineNode, p: number) => {
      const a = trunkPt(from);
      const bTrunk = trunkPt(to);
      const bTip = tipPt(to);
      const turn = 0.72;
      if (p < turn) {
        const q = p / turn;
        return { x: a.x + (bTrunk.x - a.x) * q, y: a.y + (bTrunk.y - a.y) * q };
      }
      const q = (p - turn) / (1 - turn);
      return { x: bTrunk.x + (bTip.x - bTrunk.x) * q, y: bTrunk.y + (bTip.y - bTrunk.y) * q };
    };

    let raf = 0;
    const draw = () => {
      const now = performance.now();
      neural.tick(now);
      const I = neural.intensity;
      const t = now / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // spontaneous firing while aroused
      if (I > 0.15 && Math.random() < I * 0.5) {
        const s = specialistIdx[Math.floor(Math.random() * specialistIdx.length)];
        neural.fire(nodes[s].id!, 0.5 + Math.random() * 0.5);
        if (Math.random() < I * 0.5) neural.signal('core', nodes[s].id!, Math.random() < 0.5 ? 'synapse' : 'accent', 560);
      }

      // --- trunk ---
      const cTop = trunkPt(nodes[coreIdx]);
      const cBot = trunkPt(nodes[specialistIdx[specialistIdx.length - 1]] || nodes[coreIdx]);
      const trunkGrad = ctx.createLinearGradient(0, cTop.y, 0, cBot.y);
      trunkGrad.addColorStop(0, `rgba(${core}, ${0.5 + I * 0.4})`);
      trunkGrad.addColorStop(0.5, `rgba(${accent}, ${0.22 + I * 0.3})`);
      trunkGrad.addColorStop(1, `rgba(${synapse}, ${0.18 + I * 0.3})`);
      ctx.strokeStyle = trunkGrad;
      ctx.lineWidth = 1.6 + I * 1.2;
      ctx.beginPath();
      ctx.moveTo(cTop.x, cTop.y);
      ctx.lineTo(cBot.x, cBot.y);
      ctx.stroke();

      // --- branches ---
      for (const n of nodes) {
        if (n.kind === 'core' || n.kind === 'inter') continue;
        const a = trunkPt(n);
        const b = tipPt(n);
        const fire = n.id ? neural.fires.get(n.id) : undefined;
        const firing = fire ? Math.max(0, 1 - (now - fire.at) / 700) * (fire.strength ?? 1) : 0;
        const rgb = n.kind === 'specialist' ? synapse : accent;
        ctx.strokeStyle = `rgba(${rgb}, ${0.12 + I * 0.15 + firing * 0.6})`;
        ctx.lineWidth = 0.8 + firing * 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // --- traveling signals ---
      const alive: TravelingSignal[] = [];
      for (const sig of neural.signals) {
        const p = (now - sig.start) / sig.duration;
        if (p >= 1) continue;
        alive.push(sig);
        const fi = resolve(sig.from);
        const ti = resolve(sig.to);
        if (fi === undefined || ti === undefined) continue;
        const pt = signalPt(nodes[fi], nodes[ti], p);
        const rgb = sig.hue === 'synapse' ? synapse : accent;
        const hg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 6);
        hg.addColorStop(0, `rgba(${rgb}, 0.95)`);
        hg.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      neural.signals = alive;

      // --- nodes ---
      for (const n of nodes) {
        const p = n.kind === 'inter' ? tipPt(n) : n.kind === 'core' ? trunkPt(n) : tipPt(n);
        const fire = n.id ? neural.fires.get(n.id) : undefined;
        const firing = fire ? Math.max(0, 1 - (now - fire.at) / 700) * (fire.strength ?? 1) : 0;
        const flicker = 0.5 + 0.5 * Math.sin(t * (n.kind === 'inter' ? 1.4 : 2.3) + n.phase);

        if (n.kind === 'core') {
          const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
          const R = n.r * (1 + I * 1.1 + pulse * 0.15);
          const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * (5 + I * 6));
          halo.addColorStop(0, `rgba(${core}, ${0.5 + I * 0.4})`);
          halo.addColorStop(0.4, `rgba(${accent}, ${0.12 + I * 0.2})`);
          halo.addColorStop(1, `rgba(${accent}, 0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R * (5 + I * 6), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const rgb = n.kind === 'specialist' ? synapse : accent;
        const glowAlpha = (n.kind === 'inter' ? 0.05 : 0.16) + firing * 0.8 + I * 0.1 * flicker;
        const R = n.r * (1 + firing * 1.7);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * (3 + firing * 5));
        g.addColorStop(0, `rgba(${rgb}, ${Math.min(glowAlpha, 1)})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * (3 + firing * 5), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${rgb}, ${Math.min(0.4 + firing, 1)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="neural-spine" aria-hidden="true">
      <canvas ref={canvasRef} className="neural-spine__canvas" />
    </div>
  );
}
