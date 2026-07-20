import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, synthesizeSpeech } from '../lib/api';

export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 1200;
const MAX_UTTERANCE_MS = 20000;
const MIN_AUDIO_BYTES = 1000;

interface UseVoiceChatOptions {
  /**
   * Handle a finished user utterance. Receives a `speak` callback the caller
   * pumps sentences into AS THE REPLY STREAMS, so speech starts almost
   * immediately instead of waiting for the whole answer (ChatGPT-style).
   * Resolves when generation is complete.
   */
  onTranscript: (text: string, speak: (sentence: string) => void) => Promise<void>;
}

// The browser's Web Speech API (Chrome/Edge) gives us speech-to-text and
// text-to-speech with no API key and no server round-trip. We prefer it when
// available and fall back to the server pipeline (Whisper + TTS) only when it
// isn't.
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
  const processingRef = useRef(false); // a turn (generation + speech) is in flight

  // --- TTS queue (streamed sentence playback) ---
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const genRef = useRef(false); // LLM still generating this turn
  const turnRef = useRef(0); // bumped each turn / interrupt to discard stale speech
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const usingBrowserSpeech = useRef<boolean>(getSpeechRecognition() !== null);

  const getAudioLevel = useCallback(() => audioLevelRef.current, []);

  // Resume-listening indirection so the queue/turn logic can restart whichever
  // capture path is in use without forward-referencing the starters.
  const resumeRef = useRef<() => void>(() => {});

  // ---------------------------------------------------------------------------
  // Voice selection — prefer a natural en-US voice; getVoices() populates async.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!speechSynthesisAvailable) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const vs = voicesRef.current;
    if (!vs.length) return undefined;
    return (
      vs.find((v) => /en[-_]US/i.test(v.lang) && /(Google US English|Samantha|Aria|Jenny|Natural|Neural)/i.test(v.name)) ||
      vs.find((v) => /en[-_]US/i.test(v.lang)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      vs[0]
    );
  }, []);

  // ---------------------------------------------------------------------------
  // TTS queue: play one sentence at a time so speech can start mid-generation.
  // ---------------------------------------------------------------------------
  const speakOne = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!activeRef.current) {
          resolve();
          return;
        }
        if (speechSynthesisAvailable) {
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1.05;
            u.pitch = 1;
            const v = pickVoice();
            if (v) u.voice = v;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            utteranceRef.current = u;
            window.speechSynthesis.speak(u);
          } catch {
            resolve();
          }
          return;
        }
        // Server TTS fallback.
        synthesizeSpeech(text)
          .then((blob) => {
            if (!activeRef.current) {
              resolve();
              return;
            }
            const url = URL.createObjectURL(blob);
            const audioEl = new Audio(url);
            playerRef.current = audioEl;
            audioEl.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audioEl.onerror = () => resolve();
            audioEl.play().catch(() => resolve());
          })
          .catch(() => resolve());
      }),
    [pickVoice],
  );

  const maybeResume = useCallback(() => {
    if (!activeRef.current) {
      setVoiceState('idle');
      return;
    }
    if (genRef.current || playingRef.current || queueRef.current.length) return;
    processingRef.current = false;
    setVoiceState('listening');
    resumeRef.current();
  }, []);

  const playNext = useCallback(async () => {
    if (playingRef.current) return;
    const myTurn = turnRef.current;
    const next = queueRef.current.shift();
    if (next === undefined) {
      maybeResume();
      return;
    }
    playingRef.current = true;
    setVoiceState('speaking');
    await speakOne(next);
    playingRef.current = false;
    if (turnRef.current !== myTurn) return; // interrupted — a new turn owns playback
    playNext();
  }, [speakOne, maybeResume]);

  const enqueueSpeech = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || !activeRef.current) return;
      queueRef.current.push(clean);
      if (!playingRef.current) playNext();
    },
    [playNext],
  );

  const stopPlayback = useCallback(() => {
    turnRef.current += 1; // invalidate any in-flight speakOne continuation
    queueRef.current = [];
    playingRef.current = false;
    if (speechSynthesisAvailable) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current = null;
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
      audioLevelRef.current = Math.min(0.12 + (finalText.length + interim.length) * 0.004, 0.45);
    };

    recognition.onerror = (event: any) => {
      const err = event?.error;
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
        startBrowserRecognition(); // nothing captured — keep listening
        return;
      }

      // New turn: reset speech pipeline and stream the reply into the queue.
      processingRef.current = true;
      genRef.current = true;
      turnRef.current += 1;
      queueRef.current = [];
      setInterimText('');
      setVoiceState('thinking');
      try {
        await onTranscript(text, enqueueSpeech);
      } catch (err: any) {
        setVoiceError(err?.message || 'Voice request failed');
      } finally {
        genRef.current = false;
        maybeResume(); // resume now if nothing queued; else the queue finishes then resumes
      }
    };

    try {
      recognition.start();
      setVoiceState('listening');
    } catch {
      window.setTimeout(() => {
        if (activeRef.current && !processingRef.current) startBrowserRecognition();
      }, 250);
    }
  }, [onTranscript, enqueueSpeech, maybeResume]);

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
    if (!activeRef.current || processingRef.current) return;
    setVoiceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
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

          processingRef.current = true;
          genRef.current = true;
          turnRef.current += 1;
          queueRef.current = [];
          setVoiceState('thinking');
          await onTranscript(text, enqueueSpeech);
        } catch (err: any) {
          setVoiceError(err?.message || 'Voice request failed');
        } finally {
          genRef.current = false;
          maybeResume();
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
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
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
  }, [onTranscript, enqueueSpeech, maybeResume, teardownCapture]);

  // Keep the resume indirection pointed at the active capture path.
  resumeRef.current = () => {
    if (usingBrowserSpeech.current) startBrowserRecognition();
    else startServerListening();
  };

  // ---------------------------------------------------------------------------
  // Public controls
  // ---------------------------------------------------------------------------
  const start = useCallback(() => {
    activeRef.current = true;
    processingRef.current = false;
    genRef.current = false;
    queueRef.current = [];
    setActive(true);
    setVoiceError(null);
    setInterimText('');
    resumeRef.current();
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    genRef.current = false;
    setActive(false);
    setInterimText('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    stopPlayback();
    teardownCapture();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setVoiceState('idle');
  }, [stopPlayback, teardownCapture]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  // Barge-in: stop whatever is being spoken and return to listening immediately.
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    stopPlayback();
    if (genRef.current) return; // reply still generating — it'll resume when done/drained
    processingRef.current = false;
    setVoiceState('listening');
    resumeRef.current();
  }, [stopPlayback]);

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
