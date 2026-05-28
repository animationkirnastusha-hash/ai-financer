import { useCallback, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent, type VoiceCue } from '@/features/voice/api/voice.api';
import { useVoiceRecorder } from '@/features/voice/model/useVoiceRecorder';
import type { VoiceInputMode, VoiceInputState } from '@/features/voice/model/voice.types';

type UseVoiceInputParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
};

type VoiceStartResult = 'started' | 'permission-ready' | 'busy' | 'error';

async function getMicrophonePermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined') return null;
  if (!('permissions' in navigator)) return null;

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    logVoiceDebugEvent('permission_state_checked', { permissionState: status.state });
    return status.state;
  } catch {
    return null;
  }
}

export function useVoiceInput({ onText, lang = 'ru-RU', sessionMs = 5200 }: UseVoiceInputParams) {
  const [permissionPrimed, setPermissionPrimed] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const permissionRequestInFlightRef = useRef(false);

  const recorder = useVoiceRecorder({ onText, lang, chunkMs: sessionMs });
  const mode = useMemo<VoiceInputMode>(() => 'recorder', []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  const primePermission = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);
    if (permissionPrimed) return true;

    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setPermissionPrimed(false);
      setPermissionError('unsupported');
      return false;
    }

    await getMicrophonePermissionState();
    if (permissionRequestInFlightRef.current) return false;

    permissionRequestInFlightRef.current = true;
    logVoiceDebugEvent('permission_prime_requested');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionPrimed(true);
      logVoiceDebugEvent('permission_prime_granted');
      return true;
    } catch (error) {
      setPermissionPrimed(false);
      setPermissionError('microphone-denied');
      logVoiceDebugEvent('permission_prime_denied', { error: error instanceof Error ? error.name || error.message : 'unknown' });
      throw error;
    } finally {
      permissionRequestInFlightRef.current = false;
    }
  }, [permissionPrimed]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    window.speechSynthesis?.cancel();
    setPermissionError(null);

    if (recorder.state === 'recording' || recorder.state === 'uploading') return 'busy';

    try {
      const permissionReady = await primePermission();
      if (!permissionReady) return 'permission-ready';
      await recorder.startRecording();
      return 'started';
    } catch (error) {
      console.error(error);
      return 'error';
    }
  }, [primePermission, recorder]);

  const stop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const setManualStopOnly = useCallback((value: boolean) => {
    recorder.setManualStopOnly?.(value);
  }, [recorder]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setPermissionError(null);
    recorder.cancelRecording();
  }, [recorder]);

  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setPermissionError(null);
    recorder.reset();
  }, [recorder]);

  const speak = useCallback((text: string, options?: { maxDurationMs?: number; cue?: VoiceCue }) => {
    logVoiceDebugEvent('tts_disabled_visual_only', {
      code: options?.cue,
      textLength: text.length,
    });
    window.speechSynthesis?.cancel();
  }, []);

  const state = useMemo<VoiceInputState>(() => recorder.state, [recorder.state]);
  const error = permissionError ?? recorder.error;

  return {
    mode,
    state,
    error,
    transcript: '',
    isSupported: recorder.isSupported,
    permissionPrimed,
    start,
    stop,
    cancel,
    reset,
    setManualStopOnly,
    primePermission,
    speak,
    stopSpeaking,
  };
}
