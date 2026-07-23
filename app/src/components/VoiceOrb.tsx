import { useEffect, useRef } from 'react';
import type { VoiceState } from '../hooks/useVoiceChat';

interface VoiceOrbProps {
  voiceState: VoiceState;
  getAudioLevel: () => number;
  /** Bump this (e.g. Date.now()) to play a one-shot "power up" burst. */
  powerUpTrigger?: number;
}

const BURST_DURATION_MS = 750;

// Siri-style globe: several soft, coloured light "lobes" orbit inside a sphere
// and blend additively into a luminous, morphing ball with a glassy sheen.
// Brand-violet leaning, but with the pink/blue/cyan spectrum that reads as a
// modern voice assistant. Reacts to the voice state + live mic level.
type Lobe = { color: [number, number, number]; orbit: number; size: number; speed: number; phase: number; wob: number };
const LOBES: Lobe[] = [
  { color: [236, 72, 153], orbit: 0.34, size: 0.82, speed: 0.55, phase: 0.0, wob: 1.3 }, // magenta/pink
  { color: [139, 92, 246], orbit: 0.30, size: 0.95, speed: -0.42, phase: 1.7, wob: 0.9 }, // violet (brand)
  { color: [59, 130, 246], orbit: 0.36, size: 0.80, speed: 0.63, phase: 3.1, wob: 1.6 }, // blue
  { color: [34, 211, 238], orbit: 0.28, size: 0.70, speed: -0.7, phase: 4.6, wob: 1.1 }, // cyan
  { color: [168, 85, 247], orbit: 0.22, size: 0.90, speed: 0.36, phase: 5.9, wob: 0.7 }, // purple
];

export default function VoiceOrb({ voiceState, getAudioLevel, powerUpTrigger }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(voiceState);
  stateRef.current = voiceState;
  const burstAtRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(powerUpTrigger);
  // Smoothed level so the orb eases rather than jitters with the raw mic.
  const levelRef = useRef(0);

  if (powerUpTrigger !== undefined && powerUpTrigger !== lastTriggerRef.current) {
    lastTriggerRef.current = powerUpTrigger;
    burstAtRef.current = performance.now();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      frame += 1;
      const t = frame / 60;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const state = stateRef.current;

      // Smooth the mic level toward its target.
      const target = Math.min(getAudioLevel() * 6, 1);
      levelRef.current += (target - levelRef.current) * 0.15;
      const level = levelRef.current;

      // Per-state feel: how fast it swirls, how much it breathes, how bright.
      let speed: number;
      let breathe: number;
      let bright: number;
      switch (state) {
        case 'listening':
          speed = 0.9 + level * 1.2;
          breathe = 0.05 + level * 0.16 + 0.02 * Math.sin(t * 2);
          bright = 0.9 + level * 0.5;
          break;
        case 'transcribing':
          speed = 1.7;
          breathe = 0.05 + 0.03 * Math.sin(t * 10);
          bright = 1.05;
          break;
        case 'thinking':
          speed = 2.2;
          breathe = 0.06 + 0.05 * Math.sin(t * 3.2);
          bright = 0.85 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3.2));
          break;
        case 'speaking':
          speed = 1.2 + level * 0.8;
          breathe = 0.08 + level * 0.2 + 0.04 * Math.sin(t * 7);
          bright = 1.1 + level * 0.4;
          break;
        default:
          speed = 0.4;
          breathe = 0.03 + 0.025 * Math.sin(t * 0.8);
          bright = 0.8;
      }

      const R = Math.min(w, h) * 0.28 * (1 + breathe);

      ctx.clearRect(0, 0, w, h);

      // 1) Ambient outer glow (source-over, soft violet halo).
      const halo = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 2.3);
      halo.addColorStop(0, `rgba(139,92,246,${0.22 * bright})`);
      halo.addColorStop(0.5, 'rgba(99,102,241,0.06)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // 2) Colour lobes — additive + blurred → luminous, blending sphere.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${Math.max(2, R * 0.16)}px)`;
      for (const lobe of LOBES) {
        const ang = t * lobe.speed * speed + lobe.phase;
        const orbit = lobe.orbit * (1 + 0.16 * Math.sin(t * lobe.wob + lobe.phase)) * (1 + level * 0.25);
        const lx = cx + Math.cos(ang) * R * orbit;
        const ly = cy + Math.sin(ang) * R * orbit;
        const lr = R * lobe.size;
        const [r, g, b] = lobe.color;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        grad.addColorStop(0, `rgba(${r},${g},${b},${0.5 * bright})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.18 * bright})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3) Hot near-white core, drifting slightly — the bright heart of the orb.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const coreX = cx + Math.cos(t * 0.5) * R * 0.06;
      const coreY = cy + Math.sin(t * 0.7) * R * 0.06;
      const coreR = R * (0.5 + level * 0.15);
      const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
      core.addColorStop(0, `rgba(255,255,255,${0.55 * bright})`);
      core.addColorStop(0.3, `rgba(226,214,255,${0.28 * bright})`);
      core.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4) Sphere shading — darken the rim so the ball reads as round.
      const shade = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.02);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(0.82, 'rgba(4,6,12,0)');
      shade.addColorStop(1, 'rgba(4,6,12,0.45)');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
      ctx.fill();

      // 5) Glassy specular highlight (upper-left) for the sphere sheen.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const hx = cx - R * 0.34;
      const hy = cy - R * 0.4;
      const hi = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.6);
      hi.addColorStop(0, 'rgba(255,255,255,0.35)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(hx, hy, R * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 6) Faint glass rim.
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = Math.max(1, R * 0.012);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2);
      ctx.stroke();

      // 7) One-shot power-up burst ring.
      if (burstAtRef.current !== null) {
        const elapsed = performance.now() - burstAtRef.current;
        if (elapsed < BURST_DURATION_MS) {
          const progress = elapsed / BURST_DURATION_MS;
          const burstRadius = R * (1 + progress * 2.4);
          ctx.strokeStyle = `rgba(196,181,253,${(1 - progress) * 0.6})`;
          ctx.lineWidth = Math.max(1, R * 0.05 * (1 - progress));
          ctx.beginPath();
          ctx.arc(cx, cy, burstRadius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          burstAtRef.current = null;
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [getAudioLevel]);

  return <canvas ref={canvasRef} className="voice-orb" />;
}
