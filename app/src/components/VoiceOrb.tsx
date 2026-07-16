import { useEffect, useRef } from 'react';
import type { VoiceState } from '../hooks/useVoiceChat';

interface VoiceOrbProps {
  voiceState: VoiceState;
  getAudioLevel: () => number;
}

const STATE_COLOR: Record<VoiceState, [number, number, number]> = {
  idle: [62, 224, 255],
  listening: [62, 224, 255],
  transcribing: [250, 204, 21],
  thinking: [167, 139, 250],
  speaking: [62, 224, 255],
};

const PARTICLE_COUNT = 36;

export default function VoiceOrb({ voiceState, getAudioLevel }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(voiceState);
  stateRef.current = voiceState;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      radiusJitter: 0.75 + Math.random() * 0.5,
      speed: 0.15 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
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
      const base = Math.min(w, h) * 0.16;

      ctx.clearRect(0, 0, w, h);

      const state = stateRef.current;
      const [r, g, b] = STATE_COLOR[state];
      const level = Math.min(getAudioLevel() * 6, 1);

      let pulse: number;
      let coreScale: number;
      switch (state) {
        case 'listening':
          pulse = 0.5 + 0.5 * Math.sin(t * 2);
          coreScale = 1 + level * 0.55 + pulse * 0.05;
          break;
        case 'transcribing':
          pulse = 0.5 + 0.5 * Math.sin(t * 10);
          coreScale = 1 + pulse * 0.12;
          break;
        case 'thinking':
          pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
          coreScale = 1 + pulse * 0.18;
          break;
        case 'speaking':
          pulse = 0.5 + 0.5 * Math.sin(t * 7);
          coreScale = 1 + pulse * 0.3;
          break;
        default:
          pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
          coreScale = 1 + pulse * 0.06;
      }

      const radius = base * coreScale;

      // outer soft glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3.2);
      glow.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
      glow.addColorStop(0.4, `rgba(${r},${g},${b},0.12)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // rotating reticle ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (state === 'thinking' ? 0.9 : 0.25));
      ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`;
      ctx.lineWidth = Math.max(1, base * 0.012);
      ctx.beginPath();
      const ringRadius = radius * 1.9;
      const segments = 5;
      for (let i = 0; i < segments; i++) {
        const start = (i / segments) * Math.PI * 2;
        const end = start + (Math.PI * 2) / segments - 0.35;
        ctx.moveTo(Math.cos(start) * ringRadius, Math.sin(start) * ringRadius);
        ctx.arc(0, 0, ringRadius, start, end);
      }
      ctx.stroke();
      ctx.restore();

      // orbiting particles
      for (const p of particles) {
        const wobble = Math.sin(t * p.speed * 4 + p.phase) * 0.15;
        const orbitRadius = radius * (1.55 + wobble + level * 0.4) * p.radiusJitter;
        const angle = p.angle + t * (0.12 + (state === 'listening' ? level * 0.25 : 0));
        const px = cx + Math.cos(angle) * orbitRadius;
        const py = cy + Math.sin(angle) * orbitRadius;
        const size = Math.max(1, base * 0.02 * (0.6 + level));
        ctx.fillStyle = `rgba(${r},${g},${b},${0.5 + level * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // core sphere
      const core = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.05,
        cx,
        cy,
        radius,
      );
      core.addColorStop(0, 'rgba(255,255,255,0.95)');
      core.addColorStop(0.25, `rgba(${r},${g},${b},0.95)`);
      core.addColorStop(1, `rgba(${r},${g},${b},0.05)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

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
