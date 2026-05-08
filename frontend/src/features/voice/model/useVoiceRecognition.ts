import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceRecognitionState } from '@/features/voice/model/voice.types';

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & {
  isFinal?: boolean;
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
  const cancelStopRef = useRef(false);
  const activeRef = useRef(false);
  const finalWasSentRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

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
    const text =
      finalTranscriptRef.current.trim() || transcriptRef.current.trim();

    if (!text || finalWasSentRef.current || cancelStopRef.current) return;

    finalWasSentRef.current = true;

    if (onFinalTextRef.current) {
      await onFinalTextRef.current(text);
    }
  }, []);

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
      manualStopRef.current = false;
      cancelStopRef.current = false;
      activeRef.current = true;
      finalWasSentRef.current = false;
      transcriptRef.current = '';
      finalTranscriptRef.current = '';
      clearFallbackTimer();
      setTranscript('');
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

        if (result?.isFinal) {
          finalText += chunk;
        }
      }

      const normalizedLiveText = liveText.trim();
      const normalizedFinalText = finalText.trim();

      transcriptRef.current = normalizedLiveText;
      setTranscript(normalizedLiveText);

      if (normalizedFinalText) {
        finalTranscriptRef.current = normalizedFinalText;
      }
    };

    recognition.onerror = (event) => {
      const nextError = event.error || event.message || 'speech-error';

      if ((nextError === 'aborted' || nextError === 'no-speech') && (manualStopRef.current || cancelStopRef.current)) {
        return;
      }

      activeRef.current = false;
      clearFallbackTimer();
      setError(nextError);
      setStateSafe('error');
    };

    recognition.onend = () => {
      activeRef.current = false;
      clearFallbackTimer();

      const text =
        finalTranscriptRef.current.trim() || transcriptRef.current.trim();

      if (cancelStopRef.current) {
        transcriptRef.current = '';
        finalTranscriptRef.current = '';
        setTranscript('');
        setStateSafe('idle');
        manualStopRef.current = false;
        cancelStopRef.current = false;
        return;
      }

      if (!text && manualStopRef.current) {
        setError('no-speech');
      }

      if (stateRef.current !== 'error') {
        setStateSafe('idle');
      }

      manualStopRef.current = false;

      if (text) {
        void emitFinalText();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearFallbackTimer();

      try {
        recognition.abort();
      } catch {
        // ignore
      }

      recognitionRef.current = null;
      activeRef.current = false;
    };
  }, [
    SpeechRecognitionCtor,
    clearFallbackTimer,
    emitFinalText,
    lang,
    setStateSafe,
  ]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      setError('unsupported');
      setStateSafe('unsupported');
      return;
    }

    if (activeRef.current) return;

    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    finalWasSentRef.current = false;
    manualStopRef.current = false;
    cancelStopRef.current = false;

    setTranscript('');
    setError(null);

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Speech start failed', err);
      setError('start-failed');
      setStateSafe('error');
    }
  }, [isSupported, setStateSafe]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    manualStopRef.current = true;
    cancelStopRef.current = false;

    if (!activeRef.current) {
      setStateSafe('idle');
      return;
    }

    try {
      setStateSafe('processing');
      recognitionRef.current.stop();

      clearFallbackTimer();
      fallbackTimerRef.current = window.setTimeout(() => {
        activeRef.current = false;

        try {
          recognitionRef.current?.abort();
        } catch {
          // ignore
        }

        const text =
          finalTranscriptRef.current.trim() || transcriptRef.current.trim();

        if (!text) {
          setError('no-speech');
        } else {
          void emitFinalText();
        }

        setStateSafe('idle');
      }, 1800);
    } catch (err) {
      console.error('Speech stop failed', err);
      setError('stop-failed');
      setStateSafe('error');
    }
  }, [clearFallbackTimer, emitFinalText, isSupported, setStateSafe]);

  const cancelListening = useCallback(() => {
    clearFallbackTimer();
    cancelStopRef.current = true;
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
