import { useEffect, useRef } from 'react';
import type { VoiceState } from '../hooks/useVoiceChat';

interface VoiceOrbProps {
  voiceState: VoiceState;
  getAudioLevel: () => number;
  /** Bump this (e.g. Date.now()) to play a one-shot "power up" burst. */
  powerUpTrigger?: number;
}

const ACCENT: [number, number, number] = [62, 224, 255];
const RING_COUNT = 3;
const FIBER_COUNT = 56;
const BURST_DURATION_MS = 750;

export default function VoiceOrb({ voiceState, getAudioLevel, powerUpTrigger }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(voiceState);
  stateRef.current = voiceState;
  const burstAtRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(powerUpTrigger);

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

    // Precomputed per-fiber jitter so the iris texture doesn't reshuffle every frame.
    const fibers = Array.from({ length: FIBER_COUNT }, (_, i) => ({
      angle: (i / FIBER_COUNT) * Math.PI * 2,
      lengthJitter: 0.75 + Math.random() * 0.5,
      opacityJitter: 0.4 + Math.random() * 0.6,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
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
      const outer = Math.min(w, h) * 0.28;
      const [r, g, b] = ACCENT;

      ctx.clearRect(0, 0, w, h);

      const state = stateRef.current;
      const level = Math.min(getAudioLevel() * 6, 1);

      let pulse: number;
      let pupilScale: number;
      let rotSpeed: number;
      switch (state) {
        case 'listening':
          pulse = 0.5 + 0.5 * Math.sin(t * 2);
          pupilScale = 1 + level * 0.7 + pulse * 0.04;
          rotSpeed = 0.18 + level * 0.4;
          break;
        case 'transcribing':
          pulse = 0.5 + 0.5 * Math.sin(t * 11);
          pupilScale = 1 + pulse * 0.1;
          rotSpeed = 0.55;
          break;
        case 'thinking':
          pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
          pupilScale = 1 + pulse * 0.16;
          rotSpeed = 0.85;
          break;
        case 'speaking':
          pulse = 0.5 + 0.5 * Math.sin(t * 7);
          pupilScale = 1 + pulse * 0.28;
          rotSpeed = 0.4;
          break;
        default:
          pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
          pupilScale = 1 + pulse * 0.05;
          rotSpeed = 0.06;
      }

      const rotation = t * rotSpeed;

      // outer soft glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer * 2.6);
      glow.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      glow.addColorStop(0.4, `rgba(${r},${g},${b},0.1)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, outer * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // radial iris fibers
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      for (const f of fibers) {
        const innerR = outer * 0.42;
        const outerR = outer * (0.95 + (f.lengthJitter - 1) * 0.3) * (1 + level * 0.15);
        const x1 = Math.cos(f.angle) * innerR;
        const y1 = Math.sin(f.angle) * innerR;
        const x2 = Math.cos(f.angle) * outerR;
        const y2 = Math.sin(f.angle) * outerR;
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.22 * f.opacityJitter + level * 0.15})`;
        ctx.lineWidth = Math.max(0.8, outer * 0.006);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // concentric iris rings, alternating rotation direction
      for (let i = 0; i < RING_COUNT; i++) {
        const ringRadius = outer * (0.55 + (i / (RING_COUNT - 1)) * 0.45);
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation * dir * (0.6 + i * 0.25));
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.34 - i * 0.05})`;
        ctx.lineWidth = Math.max(1, outer * 0.008);
        ctx.setLineDash([ringRadius * 0.18, ringRadius * 0.12]);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // crisp outer boundary
      ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
      ctx.lineWidth = Math.max(1, outer * 0.01);
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.stroke();

      // pupil core
      const pupilR = outer * 0.34 * pupilScale;
      const core = ctx.createRadialGradient(
        cx - pupilR * 0.3,
        cy - pupilR * 0.3,
        pupilR * 0.05,
        cx,
        cy,
        pupilR,
      );
      core.addColorStop(0, 'rgba(255,255,255,0.98)');
      core.addColorStop(0.35, `rgba(${r},${g},${b},0.95)`);
      core.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // one-shot power-up burst ring
      if (burstAtRef.current !== null) {
        const elapsed = performance.now() - burstAtRef.current;
        if (elapsed < BURST_DURATION_MS) {
          const progress = elapsed / BURST_DURATION_MS;
          const burstRadius = outer * (1 + progress * 2.6);
          const burstOpacity = (1 - progress) * 0.6;
          ctx.strokeStyle = `rgba(${r},${g},${b},${burstOpacity})`;
          ctx.lineWidth = Math.max(1, outer * 0.05 * (1 - progress));
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
