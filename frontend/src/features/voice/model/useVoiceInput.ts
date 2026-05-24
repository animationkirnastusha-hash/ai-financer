import { useCallback, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
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

  const recorder = useVoiceRecorder({
    onText,
    lang,
  });

  // Web Speech remains only as a last-resort fallback. The main product path is
  // server STT through MediaRecorder, which behaves the same on iOS and Android.
  const speech = useVoiceRecognition({
    lang,
    onFinalText: onText,
  });

  const mode = useMemo<VoiceInputMode>(() => {
    return recorder.isSupported ? 'recorder' : 'speech';
  }, [recorder.isSupported]);

  const ensurePermissionBeforeRecording = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (permissionPrimed) return true;
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setPermissionPrimed(true);
      return true;
    }

    const permissionState = await getMicrophonePermissionState();
    logVoiceDebugEvent('permission_state_checked', { permissionState: permissionState ?? 'unknown' });

    if (permissionRequestInFlightRef.current) return false;

    permissionRequestInFlightRef.current = true;

    try {
      logVoiceDebugEvent('permission_prime_requested');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      logVoiceDebugEvent('permission_prime_granted');
      setPermissionPrimed(true);
      return true;
    } catch (error) {
      logVoiceDebugEvent('permission_prime_denied', { error: error instanceof Error ? error.name || error.message : 'unknown' });
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

      if (mode === 'recorder') {
        logVoiceDebugEvent('voice_start_recorder', { mode });
        await recorder.startRecording();
        return 'started';
      }

      if (speech.isSupported) {
        logVoiceDebugEvent('voice_start_speech_fallback', { mode });
        return speech.startListening() ? 'started' : 'permission-ready';
      }

      logVoiceDebugEvent('voice_start_unsupported', { mode, isSupported: false });
      return 'error';
    } catch (err) {
      console.error(err);
      logVoiceDebugEvent('voice_start_unsupported', { mode, isSupported: false });
      return 'error';
    }
  }, [ensurePermissionBeforeRecording, mode, recorder, speech]);

  const stop = useCallback(() => {
    if (mode === 'recorder') {
      recorder.stopRecording();
      return;
    }

    speech.stopListening();
  }, [mode, recorder, speech]);

  const cancel = useCallback(() => {
    if (mode === 'recorder') {
      recorder.cancelRecording();
      return;
    }

    speech.cancelListening();
  }, [mode, recorder, speech]);

  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setPermissionError(null);
    recorder.reset();
    speech.reset();
  }, [recorder, speech]);

  const speak = useCallback(
    (_text: string, _options?: { maxDurationMs?: number }) => {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const state = useMemo<VoiceInputState>(() => {
    if (isSpeaking) return 'speaking';

    if (mode === 'recorder') {
      return recorder.state;
    }

    if (speech.state === 'listening') return 'recording';
    if (speech.state === 'processing') return 'uploading';
    if (speech.state === 'error') return 'error';
    return 'idle';
  }, [isSpeaking, mode, recorder.state, speech.state]);

  const error = permissionError ?? (mode === 'recorder' ? recorder.error : speech.error);
  const transcript = mode === 'speech' ? speech.transcript : '';
  const isSupported = recorder.isSupported || speech.isSupported;

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
