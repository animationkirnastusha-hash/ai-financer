import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceRecognitionState } from '@/features/voice/model/voice.types';

type SpeechRecognitionAlternativeLike = { transcript?: string };
type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};
type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type UseVoiceRecognitionParams = {
  lang?: string;
  onFinalText?: (text: string) => void | Promise<void>;
};

const MAX_SESSION_MS = 65000;
const STOP_FALLBACK_MS = 1400;
const START_COOLDOWN_MS = 420;
const SOFT_ERRORS = new Set(['no-speech', 'aborted', 'audio-capture', 'network']);

function compactTranscript(value: string) {
  return value.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function useVoiceRecognition({
  lang = 'ru-RU',
  onFinalText,
}: UseVoiceRecognitionParams = {}) {
  const onFinalTextRef = useRef(onFinalText);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stateRef = useRef<VoiceRecognitionState>('idle');
  const transcriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const activeRef = useRef(false);
  const manualStopRef = useRef(false);
  const suppressEmitRef = useRef(false);
  const emittedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const lastStartAtRef = useRef(0);
  const maxSessionTimerRef = useRef<number | null>(null);
  const stopFallbackTimerRef = useRef<number | null>(null);
  const startCooldownTimerRef = useRef<number | null>(null);

  const [state, setState] = useState<VoiceRecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const setStateSafe = useCallback((next: VoiceRecognitionState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (maxSessionTimerRef.current !== null) {
      window.clearTimeout(maxSessionTimerRef.current);
      maxSessionTimerRef.current = null;
    }
    if (stopFallbackTimerRef.current !== null) {
      window.clearTimeout(stopFallbackTimerRef.current);
      stopFallbackTimerRef.current = null;
    }
  }, []);

  const detachRecognition = useCallback((recognition: SpeechRecognitionInstance | null) => {
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
  }, []);

  const readText = useCallback(() => compactTranscript(finalTranscriptRef.current || transcriptRef.current), []);

  const emitFinalText = useCallback(async () => {
    const text = readText();
    if (!text || emittedRef.current || suppressEmitRef.current) return;

    emittedRef.current = true;
    await onFinalTextRef.current?.(text);
  }, [readText]);

  const finishSession = useCallback((sessionId: number, options?: { emit?: boolean; error?: string | null }) => {
    if (sessionId !== sessionIdRef.current) return;

    clearTimers();
    activeRef.current = false;
    manualStopRef.current = false;

    if (options?.error) {
      setError(options.error);
      setStateSafe('error');
    } else {
      if (!suppressEmitRef.current) setError(null);
      setStateSafe(SpeechRecognitionCtor ? 'idle' : 'unsupported');
    }

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    detachRecognition(recognition);

    if (options?.emit) {
      void emitFinalText();
    }
  }, [SpeechRecognitionCtor, clearTimers, detachRecognition, emitFinalText, setStateSafe]);

  const abortCurrentRecognition = useCallback((options?: { suppressEmit?: boolean }) => {
    clearTimers();
    suppressEmitRef.current = options?.suppressEmit ?? true;
    manualStopRef.current = false;

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    activeRef.current = false;

    try {
      recognition?.abort();
    } catch {
      // ignore browser-specific abort errors
    }

    detachRecognition(recognition);
    setStateSafe(SpeechRecognitionCtor ? 'idle' : 'unsupported');
  }, [SpeechRecognitionCtor, clearTimers, detachRecognition, setStateSafe]);

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    const supported = Boolean(SpeechRecognitionCtor);
    setIsSupported(supported);
    setStateSafe(supported ? 'idle' : 'unsupported');

    return () => {
      abortCurrentRecognition({ suppressEmit: true });
      if (startCooldownTimerRef.current !== null) {
        window.clearTimeout(startCooldownTimerRef.current);
        startCooldownTimerRef.current = null;
      }
    };
  }, [SpeechRecognitionCtor, abortCurrentRecognition, setStateSafe]);

  const startListening = useCallback((): boolean => {
    if (!SpeechRecognitionCtor) {
      setError('unsupported');
      setStateSafe('unsupported');
      return false;
    }

    if (activeRef.current || stateRef.current === 'processing') return false;

    const now = Date.now();
    if (now - lastStartAtRef.current < START_COOLDOWN_MS || startCooldownTimerRef.current !== null) return false;
    lastStartAtRef.current = now;

    abortCurrentRecognition({ suppressEmit: true });

    const recognition = new SpeechRecognitionCtor();
    const sessionId = sessionIdRef.current + 1;
    sessionIdRef.current = sessionId;

    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    emittedRef.current = false;
    suppressEmitRef.current = false;
    manualStopRef.current = false;
    setTranscript('');
    setError(null);

    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      if (sessionId !== sessionIdRef.current) return;
      activeRef.current = true;
      setStateSafe('listening');

      maxSessionTimerRef.current = window.setTimeout(() => {
        if (sessionId !== sessionIdRef.current) return;
        try {
          recognition.stop();
        } catch {
          try {
            recognition.abort();
          } catch {
            // ignore
          }
        }
      }, MAX_SESSION_MS);
    };

    recognition.onresult = (event) => {
      if (sessionId !== sessionIdRef.current) return;

      let liveText = '';
      let finalText = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const chunk = result?.[0]?.transcript ?? '';
        liveText += chunk;
        if (result?.isFinal) finalText += chunk;
      }

      const normalizedLive = compactTranscript(liveText);
      const normalizedFinal = compactTranscript(finalText);

      if (normalizedLive) {
        transcriptRef.current = normalizedLive;
        setTranscript(normalizedLive);
      }

      if (normalizedFinal) {
        finalTranscriptRef.current = normalizedFinal;
      }
    };

    recognition.onerror = (event) => {
      if (sessionId !== sessionIdRef.current) return;

      const nextError = event.error || event.message || 'speech-error';
      if (manualStopRef.current) return;

      if (SOFT_ERRORS.has(nextError)) {
        finishSession(sessionId, { emit: false });
        return;
      }

      finishSession(sessionId, { emit: false, error: nextError });
    };

    recognition.onend = () => {
      if (sessionId !== sessionIdRef.current) return;
      const hasText = Boolean(readText());
      finishSession(sessionId, { emit: hasText && !suppressEmitRef.current });
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      return true;
    } catch (startError) {
      console.error('SpeechRecognition start failed', startError);
      recognitionRef.current = null;
      detachRecognition(recognition);
      activeRef.current = false;
      setError('start-failed');
      setStateSafe('idle');

      if (startCooldownTimerRef.current !== null) {
        window.clearTimeout(startCooldownTimerRef.current);
      }
      startCooldownTimerRef.current = window.setTimeout(() => {
        startCooldownTimerRef.current = null;
      }, START_COOLDOWN_MS);

      return false;
    }
  }, [SpeechRecognitionCtor, abortCurrentRecognition, detachRecognition, finishSession, lang, readText, setStateSafe]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current) {
      const sessionId = sessionIdRef.current;
      finishSession(sessionId, { emit: Boolean(readText()) });
      return;
    }

    manualStopRef.current = true;
    setStateSafe('processing');

    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      finishSession(sessionIdRef.current, { emit: Boolean(readText()) });
      return;
    }

    clearTimers();
    stopFallbackTimerRef.current = window.setTimeout(() => {
      finishSession(sessionIdRef.current, { emit: Boolean(readText()) });
    }, STOP_FALLBACK_MS);
  }, [clearTimers, finishSession, readText, setStateSafe]);

  const cancelListening = useCallback(() => {
    abortCurrentRecognition({ suppressEmit: true });
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    emittedRef.current = true;
    setTranscript('');
    setError(null);
  }, [abortCurrentRecognition]);

  const reset = useCallback(() => {
    cancelListening();
  }, [cancelListening]);

  return {
    state,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    cancelListening,
    reset,
  };
}
