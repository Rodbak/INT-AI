import { useCallback, useRef, useState } from 'react';
import { transcribeAudio, synthesizeSpeech } from '../lib/api';

export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 1200;
const MAX_UTTERANCE_MS = 20000;
const MIN_AUDIO_BYTES = 1000;

interface UseVoiceChatOptions {
  onTranscript: (text: string) => Promise<string | void>;
}

export function useVoiceChat({ onTranscript }: UseVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const activeRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);

  const stopVad = useCallback(() => {
    if (vadFrameRef.current !== null) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const teardownCapture = useCallback(() => {
    stopVad();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [stopVad]);

  const startListening = useCallback(async () => {
    if (!activeRef.current) return;
    setVoiceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        teardownCapture();
        if (!activeRef.current) return;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < MIN_AUDIO_BYTES) {
          startListening();
          return;
        }

        setVoiceState('transcribing');
        try {
          const text = await transcribeAudio(blob);
          if (!activeRef.current) return;
          if (!text.trim()) {
            startListening();
            return;
          }

          setVoiceState('thinking');
          const reply = await onTranscript(text);
          if (!activeRef.current) return;

          if (reply && reply.trim()) {
            setVoiceState('speaking');
            await speak(reply);
          }
        } catch (err: any) {
          setVoiceError(err?.message || 'Voice request failed');
        } finally {
          if (activeRef.current) {
            startListening();
          } else {
            setVoiceState('idle');
          }
        }
      };

      recorder.start();
      setVoiceState('listening');

      const buffer = new Uint8Array(analyser.fftSize);
      let hasSpoken = false;
      const startedAt = Date.now();

      const tick = () => {
        if (!activeRef.current || recorderRef.current?.state !== 'recording') return;

        analyser.getByteTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          const normalized = (buffer[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);

        if (rms > SILENCE_RMS_THRESHOLD) {
          hasSpoken = true;
          if (silenceTimerRef.current !== null) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpoken && silenceTimerRef.current === null) {
          silenceTimerRef.current = window.setTimeout(() => {
            if (recorderRef.current?.state === 'recording') {
              recorderRef.current.stop();
            }
          }, SILENCE_HOLD_MS);
        }

        if (Date.now() - startedAt > MAX_UTTERANCE_MS) {
          if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop();
          }
          return;
        }

        vadFrameRef.current = requestAnimationFrame(tick);
      };
      vadFrameRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      setVoiceError(err?.message || 'Microphone access failed');
      setVoiceState('idle');
      activeRef.current = false;
      setActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTranscript, teardownCapture]);

  const speak = useCallback(async (text: string) => {
    try {
      const blob = await synthesizeSpeech(text);
      if (!activeRef.current) return;
      const url = URL.createObjectURL(blob);
      const audioEl = new Audio(url);
      playerRef.current = audioEl;
      await new Promise<void>((resolve) => {
        audioEl.onended = () => resolve();
        audioEl.onerror = () => resolve();
        audioEl.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      playerRef.current = null;
    } catch (err: any) {
      setVoiceError(err?.message || 'Speech playback failed');
    }
  }, []);

  const start = useCallback(() => {
    activeRef.current = true;
    setActive(true);
    startListening();
  }, [startListening]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    teardownCapture();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current = null;
    }
    setVoiceState('idle');
  }, [teardownCapture]);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current = null;
    }
    if (recorderRef.current?.state !== 'recording') {
      startListening();
    }
  }, [startListening]);

  return { voiceState, voiceError, active, toggle, interrupt };
}
