import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, synthesizeSpeech } from '../lib/api';

export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 1200;
const MAX_UTTERANCE_MS = 20000;
const MIN_AUDIO_BYTES = 1000;

interface UseVoiceChatOptions {
  onTranscript: (text: string) => Promise<string | void>;
}

// The browser's Web Speech API (Chrome/Edge) gives us speech-to-text and
// text-to-speech with no API key and no server round-trip. We prefer it when
// available and fall back to the server pipeline (OpenAI Whisper + TTS, which
// requires OPENAI_API_KEY) only when it isn't.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const speechSynthesisAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useVoiceChat({ onTranscript }: UseVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [interimText, setInterimText] = useState('');

  const activeRef = useRef(false);
  const audioLevelRef = useRef(0);

  // --- server-pipeline refs (fallback path) ---
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const MAX_VOICE_RETRIES = 5;

  // --- browser Web Speech refs (primary path) ---
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const processingRef = useRef(false);

  // --- shared playback ---
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const usingBrowserSpeech = useRef<boolean>(getSpeechRecognition() !== null);

  const getAudioLevel = useCallback(() => audioLevelRef.current, []);

  // ---------------------------------------------------------------------------
  // Text-to-speech (shared): prefer the browser's speechSynthesis, else server.
  // ---------------------------------------------------------------------------
  const speak = useCallback(async (text: string) => {
    if (speechSynthesisAvailable) {
      await new Promise<void>((resolve) => {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.02;
          utterance.pitch = 1;
          const preferred = window.speechSynthesis
            .getVoices()
            .find((v) => /en-US/i.test(v.lang) && /(natural|google|samantha|aria)/i.test(v.name));
          if (preferred) utterance.voice = preferred;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve();
        }
      });
      utteranceRef.current = null;
      return;
    }

    // Server TTS fallback (requires OPENAI_API_KEY on the backend).
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

  // ---------------------------------------------------------------------------
  // Browser Web Speech recognition path
  // ---------------------------------------------------------------------------
  const startBrowserRecognition = useCallback(() => {
    if (!activeRef.current || processingRef.current) return;
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimText((finalText + interim).trim());
      // Fake a little audio-level movement so the orb reacts while hearing speech.
      audioLevelRef.current = Math.min(0.12 + (finalText.length + interim.length) * 0.004, 0.45);
    };

    recognition.onerror = (event: any) => {
      const err = event?.error;
      // Transient errors self-recover via the onend restart below.
      if (err === 'no-speech' || err === 'aborted' || err === 'network') return;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setVoiceError('Microphone access was blocked. Allow mic access to use hands-free mode.');
        activeRef.current = false;
        setActive(false);
        setVoiceState('idle');
        return;
      }
      if (err === 'audio-capture') {
        setVoiceError('No microphone was found. Connect a mic to use hands-free mode.');
        activeRef.current = false;
        setActive(false);
        setVoiceState('idle');
        return;
      }
      setVoiceError(`Voice recognition error: ${err || 'unknown'}`);
    };

    recognition.onend = async () => {
      audioLevelRef.current = 0;
      recognitionRef.current = null;
      if (!activeRef.current || processingRef.current) return;

      const text = finalText.trim();
      if (!text) {
        // Nothing captured — keep listening.
        startBrowserRecognition();
        return;
      }

      processingRef.current = true;
      setInterimText('');
      setVoiceState('thinking');
      try {
        const reply = await onTranscript(text);
        if (activeRef.current && reply && reply.trim()) {
          setVoiceState('speaking');
          await speak(reply);
        }
      } catch (err: any) {
        setVoiceError(err?.message || 'Voice request failed');
      } finally {
        processingRef.current = false;
        if (activeRef.current) {
          setVoiceState('listening');
          startBrowserRecognition();
        } else {
          setVoiceState('idle');
        }
      }
    };

    try {
      recognition.start();
      setVoiceState('listening');
    } catch {
      // start() throws if called too soon after a previous stop; retry shortly.
      window.setTimeout(() => {
        if (activeRef.current && !processingRef.current) startBrowserRecognition();
      }, 250);
    }
  }, [onTranscript, speak]);

  // ---------------------------------------------------------------------------
  // Server-pipeline recognition path (MediaRecorder + Whisper) — fallback only
  // ---------------------------------------------------------------------------
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
    audioLevelRef.current = 0;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [stopVad]);

  const startServerListening = useCallback(async () => {
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
          retryCountRef.current += 1;
          if (retryCountRef.current >= MAX_VOICE_RETRIES) {
            setVoiceState('idle');
            setVoiceError('Voice mode stopped after multiple silent recordings.');
            setActive(false);
            activeRef.current = false;
            return;
          }
          startServerListening();
          return;
        }

        setVoiceState('transcribing');
        try {
          const text = await transcribeAudio(blob);
          if (!activeRef.current) return;
          if (!text.trim()) {
            startServerListening();
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
            startServerListening();
          } else {
            setVoiceState('idle');
          }
        }
      };

      recorder.start();
      setVoiceState('listening');
      retryCountRef.current = 0;

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
        audioLevelRef.current = rms;

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
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
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
  }, [onTranscript, teardownCapture, speak]);

  // ---------------------------------------------------------------------------
  // Public controls
  // ---------------------------------------------------------------------------
  const start = useCallback(() => {
    activeRef.current = true;
    processingRef.current = false;
    setActive(true);
    setVoiceError(null);
    setInterimText('');
    if (usingBrowserSpeech.current) startBrowserRecognition();
    else startServerListening();
  }, [startBrowserRecognition, startServerListening]);

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    setActive(false);
    setInterimText('');

    // Browser path
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    if (speechSynthesisAvailable) window.speechSynthesis.cancel();
    utteranceRef.current = null;

    // Server path
    teardownCapture();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current = null;
    }
    setVoiceState('idle');
  }, [teardownCapture]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    // Stop whatever is currently being spoken and return to listening.
    if (speechSynthesisAvailable) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current = null;
    }
    if (usingBrowserSpeech.current) {
      if (!processingRef.current && !recognitionRef.current) {
        setVoiceState('listening');
        startBrowserRecognition();
      }
    } else if (recorderRef.current?.state !== 'recording') {
      startServerListening();
    }
  }, [startBrowserRecognition, startServerListening]);

  // Release everything if the component using this unmounts mid-session.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      if (speechSynthesisAvailable) window.speechSynthesis.cancel();
      teardownCapture();
    };
  }, [teardownCapture]);

  return {
    voiceState,
    voiceError,
    active,
    interimText,
    toggle,
    interrupt,
    start,
    stop,
    getAudioLevel,
    usesBrowserSpeech: usingBrowserSpeech.current,
  };
}
