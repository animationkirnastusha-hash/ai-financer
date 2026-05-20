import { useCallback, useMemo, useRef, useState } from 'react';
import { useVoiceRecognition } from '@/features/voice/model/useVoiceRecognition';
import { useVoiceRecorder } from '@/features/voice/model/useVoiceRecorder';
import type {
  VoiceInputMode,
  VoiceInputState,
} from '@/features/voice/model/voice.types';

type UseVoiceInputParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
};

type VoiceStartResult = 'started' | 'permission-ready' | 'error';

async function getMicrophonePermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined') return null;
  if (!('permissions' in navigator)) return null;

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

export function useVoiceInput({
  onText,
  lang = 'ru-RU',
}: UseVoiceInputParams) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [permissionPrimed, setPermissionPrimed] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const permissionRequestInFlightRef = useRef(false);

  const speech = useVoiceRecognition({
    lang,
    onFinalText: onText,
  });

  const recorder = useVoiceRecorder({
    onText,
  });

  const mode = useMemo<VoiceInputMode>(() => {
    return speech.isSupported ? 'speech' : 'recorder';
  }, [speech.isSupported]);

  const ensurePermissionBeforeRecording = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (permissionPrimed) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermissionPrimed(true);
      return true;
    }

    await getMicrophonePermissionState();

    if (permissionRequestInFlightRef.current) return false;

    permissionRequestInFlightRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionPrimed(true);
      return true;
    } catch (error) {
      setPermissionPrimed(false);
      setPermissionError('microphone-denied');
      throw error;
    } finally {
      permissionRequestInFlightRef.current = false;
    }
  }, [permissionPrimed]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    window.speechSynthesis?.cancel();
    setPermissionError(null);

    try {
      const canStartNow = await ensurePermissionBeforeRecording();

      if (!canStartNow) {
        return 'permission-ready';
      }

      if (speech.isSupported) {
        speech.startListening();
        return 'started';
      }

      await recorder.startRecording();
      return 'started';
    } catch (err) {
      console.error(err);
      return 'error';
    }
  }, [ensurePermissionBeforeRecording, recorder, speech]);

  const stop = useCallback(() => {
    if (speech.isSupported) {
      speech.stopListening();
      return;
    }

    recorder.stopRecording();
  }, [recorder, speech]);

  const cancel = useCallback(() => {
    if (speech.isSupported) {
      speech.cancelListening();
      return;
    }

    recorder.cancelRecording();
  }, [recorder, speech]);

  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setPermissionError(null);
    speech.reset();
    recorder.reset();
  }, [recorder, speech]);

  const speak = useCallback(
    (text: string) => {
      const cleanText = text.trim();

      if (!cleanText || typeof window === 'undefined') return;
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const state = useMemo<VoiceInputState>(() => {
    if (isSpeaking) return 'speaking';

    if (mode === 'speech') {
      if (speech.state === 'listening') return 'recording';
      if (speech.state === 'processing') return 'uploading';
      if (speech.state === 'error') return 'error';
      return 'idle';
    }

    return recorder.state;
  }, [isSpeaking, mode, recorder.state, speech.state]);

  const error = permissionError ?? (mode === 'speech' ? speech.error : recorder.error);
  const transcript = mode === 'speech' ? speech.transcript : '';
  const isSupported = speech.isSupported || recorder.isSupported;

  return {
    mode,
    state,
    error,
    transcript,
    isSupported,
    permissionPrimed,
    start,
    stop,
    cancel,
    reset,
    speak,
    stopSpeaking,
  };
}
