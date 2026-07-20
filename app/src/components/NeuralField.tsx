import { useEffect, useRef } from 'react';
import { neural, type TravelingSignal } from '../lib/neural';

interface NeuralFieldProps {
  /** Extra scattered interneurons for organic density. */
  density?: number;
  /** Overall opacity of the whole field (backgrounds run dim). */
  opacity?: number;
  /** Draw the bright central nucleus (the "core"). */
  showCore?: boolean;
  className?: string;
}

interface Node {
  id?: string;
  x: number; // normalized 0..1
  y: number;
  r: number; // base radius in px at 1x
  kind: 'core' | 'provider' | 'specialist' | 'inter';
  phase: number; // for idle flicker
}

interface Edge {
  a: number;
  b: number;
}

const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'];
const SPECIALIST_SLOTS = 8;

function hashToSlot(s: string, slots: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % slots;
}

export default function NeuralField({
  density = 26,
  opacity = 1,
  showCore = true,
  className,
}: NeuralFieldProps) {
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
    const hueRGB = (h: 'accent' | 'synapse') => (h === 'synapse' ? synapse : accent);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // --- build the network once (positions are normalized, rescaled on resize) ---
    const nodes: Node[] = [];
    const idIndex = new Map<string, number>();

    const push = (n: Node) => {
      const i = nodes.length;
      nodes.push(n);
      if (n.id) idIndex.set(n.id, i);
      return i;
    };

    // The network hangs as a storm cloud across the TOP of the viewport and
    // dissipates downward, leaving the lower area calm for readable text. The
    // core sits up in the cloud; providers/specialists arc beneath it; a wide
    // band of interneurons gives the cloud its body.
    const CY = 0.16; // vertical center of the cloud

    const coreIdx = push({ id: 'core', x: 0.5, y: CY, r: 7, kind: 'core', phase: 0 });

    const providerIdx: number[] = [];
    PROVIDERS.forEach((p, i) => {
      const a = (i / PROVIDERS.length) * Math.PI * 2 - Math.PI / 2;
      providerIdx.push(
        push({
          id: `provider:${p}`,
          x: 0.5 + Math.cos(a) * 0.15,
          y: CY + Math.sin(a) * 0.085,
          r: 4.5,
          kind: 'provider',
          phase: Math.random() * 6.283,
        }),
      );
    });

    const specialistIdx: number[] = [];
    for (let i = 0; i < SPECIALIST_SLOTS; i++) {
      const a = (i / SPECIALIST_SLOTS) * Math.PI - 0.15; // spread across the top, below the core
      const rad = 0.28 + (i % 2) * 0.06;
      specialistIdx.push(
        push({
          id: `specialist:slot${i}`,
          x: 0.5 + Math.cos(a) * rad * 1.3,
          y: CY + 0.03 + Math.abs(Math.sin(a)) * rad * 0.75,
          r: 3.6,
          kind: 'specialist',
          phase: Math.random() * 6.283,
        }),
      );
    }

    // scattered interneurons: full width, biased toward the top (cloud body)
    for (let i = 0; i < density; i++) {
      push({
        x: 0.04 + Math.random() * 0.92,
        y: 0.02 + Math.pow(Math.random(), 1.7) * 0.42,
        r: 1.4 + Math.random() * 1.8,
        kind: 'inter',
        phase: Math.random() * 6.283,
      });
    }

    // --- edges: core->providers, providers->specialists, + near-neighbor web ---
    const edges: Edge[] = [];
    const edgeKey = new Set<string>();
    const addEdge = (a: number, b: number) => {
      if (a === b) return;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edgeKey.has(k)) return;
      edgeKey.add(k);
      edges.push({ a, b });
    };

    providerIdx.forEach((p) => addEdge(coreIdx, p));
    // each specialist connects to its nearest provider
    specialistIdx.forEach((s) => {
      let best = providerIdx[0];
      let bestD = Infinity;
      for (const p of providerIdx) {
        const d = (nodes[p].x - nodes[s].x) ** 2 + (nodes[p].y - nodes[s].y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      addEdge(best, s);
    });
    // organic web: connect every node to its 2 nearest neighbors
    for (let i = 0; i < nodes.length; i++) {
      const dists: { j: number; d: number }[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        dists.push({ j, d: (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2 });
      }
      dists.sort((a, b) => a.d - b.d);
      addEdge(i, dists[0].j);
      if (nodes[i].kind === 'inter') addEdge(i, dists[1].j);
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

    const px = (n: Node) => ({ x: n.x * W, y: n.y * H });

    let raf = 0;
    const draw = () => {
      const now = performance.now();
      neural.tick(now);
      const I = neural.intensity; // 0..1
      const t = now / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // spontaneous firing while aroused — this is what makes tasks feel intense
      if (I > 0.15 && Math.random() < I * 0.5) {
        const s = specialistIdx[Math.floor(Math.random() * specialistIdx.length)];
        neural.fire(nodes[s].id!, 0.5 + Math.random() * 0.5);
        if (Math.random() < I * 0.4) neural.signal(nodes[s].id!, 'core', Math.random() < 0.5 ? 'synapse' : 'accent', 520);
      }

      // --- edges ---
      for (const e of edges) {
        const a = px(nodes[e.a]);
        const b = px(nodes[e.b]);
        const touchesCore = nodes[e.a].kind === 'core' || nodes[e.b].kind === 'core';
        const base = touchesCore ? 0.05 : 0.025;
        const alpha = base + I * (touchesCore ? 0.22 : 0.1);
        ctx.strokeStyle = `rgba(${accent}, ${alpha})`;
        ctx.lineWidth = touchesCore ? 1.1 : 0.6;
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
        const a = px(nodes[fi]);
        const b = px(nodes[ti]);
        const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        const x = a.x + (b.x - a.x) * ease;
        const y = a.y + (b.y - a.y) * ease;
        const rgb = hueRGB(sig.hue);
        // trail
        const trail = ctx.createLinearGradient(a.x, a.y, x, y);
        trail.addColorStop(0, `rgba(${rgb}, 0)`);
        trail.addColorStop(1, `rgba(${rgb}, ${0.5 * (1 - p)})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        // head
        const hg = ctx.createRadialGradient(x, y, 0, x, y, 7);
        hg.addColorStop(0, `rgba(${rgb}, 0.95)`);
        hg.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      neural.signals = alive;

      // --- nodes ---
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.kind === 'core' && !showCore) continue;
        const p = px(n);
        const fire = n.id ? neural.fires.get(n.id) : undefined;
        const fireAge = fire ? (now - fire.at) / 700 : 1;
        const firing = fireAge < 1 ? (1 - fireAge) * (fire?.strength ?? 1) : 0;
        const flicker = 0.5 + 0.5 * Math.sin(t * (n.kind === 'inter' ? 1.5 : 2.4) + n.phase);

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
          ctx.fillStyle = `rgba(255,255,255,${0.85})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const rgb = n.kind === 'specialist' ? synapse : accent;
        const glowAlpha = (n.kind === 'inter' ? 0.06 : 0.18) + firing * 0.8 + I * 0.1 * flicker;
        const R = n.r * (1 + firing * 1.6);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * (3 + firing * 5));
        g.addColorStop(0, `rgba(${rgb}, ${Math.min(glowAlpha, 1)})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * (3 + firing * 5), 0, Math.PI * 2);
        ctx.fill();
        // crisp center
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
  }, [density, showCore]);

  return <canvas ref={canvasRef} className={className} style={{ opacity }} aria-hidden="true" />;
}
