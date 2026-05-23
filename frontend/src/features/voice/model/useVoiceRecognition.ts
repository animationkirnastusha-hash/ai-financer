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

export function useVoiceRecognition({
  lang = 'ru-RU',
  onFinalText,
}: UseVoiceRecognitionParams = {}) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalTextRef = useRef(onFinalText);

  const stateRef = useRef<VoiceRecognitionState>('idle');
  const transcriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const manualStopRef = useRef(false);
  const activeRef = useRef(false);
  const finalWasSentRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const restartCooldownRef = useRef<number | null>(null);
  const processingStartedAtRef = useRef(0);

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

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const emitFinalText = useCallback(async () => {
    const text = finalTranscriptRef.current.trim() || transcriptRef.current.trim();
    if (!text || finalWasSentRef.current) return;

    finalWasSentRef.current = true;
    await onFinalTextRef.current?.(text);
  }, []);

  const finishCurrentSession = useCallback((options?: { emit?: boolean; noSpeechError?: boolean }) => {
    clearFallbackTimer();
    processingStartedAtRef.current = 0;
    activeRef.current = false;

    const text = finalTranscriptRef.current.trim() || transcriptRef.current.trim();

    if (options?.noSpeechError && !text) {
      setError('no-speech');
    }

    manualStopRef.current = false;
    setStateSafe('idle');

    if (options?.emit && text) {
      void emitFinalText();
    }
  }, [clearFallbackTimer, emitFinalText, setStateSafe]);

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      setStateSafe('unsupported');
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      activeRef.current = true;
      finalWasSentRef.current = false;
      clearFallbackTimer();
      setError(null);
      setStateSafe('listening');
    };

    recognition.onresult = (event) => {
      let liveText = '';
      let finalText = '';

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = result?.[0]?.transcript ?? '';
        liveText += chunk;
        if (result?.isFinal) finalText += chunk;
      }

      const normalizedLiveText = liveText.trim();
      const normalizedFinalText = finalText.trim();

      if (normalizedLiveText) {
        transcriptRef.current = normalizedLiveText;
        setTranscript(normalizedLiveText);
      }

      if (normalizedFinalText) {
        finalTranscriptRef.current = normalizedFinalText;
      }
    };

    recognition.onerror = (event) => {
      const nextError = event.error || event.message || 'speech-error';
      const isSoftError = nextError === 'no-speech' || nextError === 'aborted' || nextError === 'audio-capture';

      if (manualStopRef.current) {
        finishCurrentSession({ emit: true, noSpeechError: nextError === 'no-speech' || nextError === 'aborted' });
        return;
      }

      activeRef.current = false;
      clearFallbackTimer();

      if (isSoftError) {
        setError(nextError === 'audio-capture' ? 'speech-restart' : nextError);
        setStateSafe('idle');
        return;
      }

      setError(nextError);
      setStateSafe('error');
    };

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim() || transcriptRef.current.trim();

      if (manualStopRef.current) {
        finishCurrentSession({ emit: true, noSpeechError: !text });
        return;
      }

      finishCurrentSession({ emit: Boolean(text), noSpeechError: false });
    };

    recognitionRef.current = recognition;

    return () => {
      clearFallbackTimer();
      if (restartCooldownRef.current !== null) {
        window.clearTimeout(restartCooldownRef.current);
        restartCooldownRef.current = null;
      }
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      activeRef.current = false;
    };
  }, [SpeechRecognitionCtor, clearFallbackTimer, finishCurrentSession, lang, setStateSafe]);


  useEffect(() => {
    const interval = window.setInterval(() => {
      if (stateRef.current !== 'processing') return;
      if (!processingStartedAtRef.current) return;
      if (Date.now() - processingStartedAtRef.current < 1600) return;

      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }

      finishCurrentSession({ emit: true, noSpeechError: false });
    }, 500);

    return () => window.clearInterval(interval);
  }, [finishCurrentSession]);

  const startListening = useCallback((): boolean => {
    if (!recognitionRef.current || !isSupported) {
      setError('unsupported');
      setStateSafe('unsupported');
      return false;
    }

    if (activeRef.current || stateRef.current === 'processing') return false;

    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    finalWasSentRef.current = false;
    manualStopRef.current = false;

    setTranscript('');
    setError(null);

    try {
      recognitionRef.current.start();
      return true;
    } catch (err) {
      console.error('Speech start failed', err);
      activeRef.current = false;
      setError('start-failed');
      setStateSafe('idle');

      if (restartCooldownRef.current !== null) {
        window.clearTimeout(restartCooldownRef.current);
      }
      restartCooldownRef.current = window.setTimeout(() => {
        restartCooldownRef.current = null;
      }, 180);

      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }

      return false;
    }
  }, [isSupported, setStateSafe]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    manualStopRef.current = true;

    if (!activeRef.current) {
      finishCurrentSession({ emit: true, noSpeechError: false });
      return;
    }

    try {
      processingStartedAtRef.current = Date.now();
      setStateSafe('processing');
      recognitionRef.current.stop();

      clearFallbackTimer();
      fallbackTimerRef.current = window.setTimeout(() => {
        try {
          recognitionRef.current?.abort();
        } catch {
          // ignore
        }
        finishCurrentSession({ emit: true, noSpeechError: true });
      }, 950);
    } catch (err) {
      console.error('Speech stop failed', err);
      setError('stop-failed');
      setStateSafe('error');
    }
  }, [clearFallbackTimer, finishCurrentSession, isSupported, setStateSafe]);

  const cancelListening = useCallback(() => {
    clearFallbackTimer();
    manualStopRef.current = false;
    finalWasSentRef.current = true;

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    activeRef.current = false;

    setTranscript('');
    setError(null);
    setStateSafe(isSupported ? 'idle' : 'unsupported');
  }, [clearFallbackTimer, isSupported, setStateSafe]);

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
