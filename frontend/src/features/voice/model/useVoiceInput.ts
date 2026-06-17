import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent, type VoiceCue } from '@/features/voice/api/voice.api';
import { useVoiceRecorder } from '@/features/voice/model/useVoiceRecorder';
import type { VoiceInputMode, VoiceInputState } from '@/features/voice/model/voice.types';

type UseVoiceInputParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
  permissionWasPrompted?: boolean;
};

type VoiceStartResult = 'started' | 'permission-ready' | 'busy' | 'error';
type MicrophonePermissionState = PermissionState | 'unsupported' | 'unknown';

async function queryMicrophonePermissionState(): Promise<PermissionState | null> {
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
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const permissionRequestInFlightRef = useRef(false);

  const recorder = useVoiceRecorder({ onText, lang, chunkMs: sessionMs });
  const mode = useMemo<VoiceInputMode>(() => 'recorder', []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  const refreshPermissionState = useCallback(async (): Promise<MicrophonePermissionState> => {
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setPermissionState('unsupported');
      setPermissionPrimed(false);
      return 'unsupported';
    }

    const queried = await queryMicrophonePermissionState();
    if (queried) {
      setPermissionState(queried);
      if (queried === 'granted') {
        setPermissionPrimed(true);
        setPermissionError(null);
      }
      if (queried === 'denied') {
        setPermissionPrimed(false);
        setPermissionError('microphone-denied');
      }
      return queried;
    }

    setPermissionState('unknown');
    return 'unknown';
  }, []);

  useEffect(() => {
    void refreshPermissionState();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPermissionState();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshPermissionState]);

  const primePermission = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (permissionPrimed) return true;

    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setPermissionPrimed(false);
      setPermissionState('unsupported');
      setPermissionError('unsupported');
      return false;
    }

    const currentPermission = await refreshPermissionState();
    if (currentPermission === 'granted') {
      setPermissionPrimed(true);
      return true;
    }

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
      setPermissionState('granted');
      setPermissionError(null);
      logVoiceDebugEvent('permission_prime_granted');
      return true;
    } catch (error) {
      setPermissionPrimed(false);
      setPermissionState('denied');
      setPermissionError('microphone-denied');
      logVoiceDebugEvent('permission_prime_denied', { error: error instanceof Error ? error.name || error.message : 'unknown' });
      throw error;
    } finally {
      permissionRequestInFlightRef.current = false;
    }
  }, [permissionPrimed, refreshPermissionState]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    window.speechSynthesis?.cancel();
    setPermissionError(null);

    if (recorder.state === 'recording' || recorder.state === 'uploading') return 'busy';

    try {
      const currentPermission = await refreshPermissionState();

      if (currentPermission === 'denied') {
        logVoiceDebugEvent('manual_voice_start_blocked_permission_denied', { permissionState: currentPermission });
        setPermissionPrimed(false);
        setPermissionError('microphone-denied');
        return 'permission-ready';
      }

      if (currentPermission !== 'granted' && !permissionPrimed) {
        logVoiceDebugEvent('manual_voice_start_blocked_permission', { permissionState: currentPermission });
        return 'permission-ready';
      }

      await recorder.startRecording();
      return 'started';
    } catch (error) {
      console.error(error);
      return 'error';
    }
  }, [permissionPrimed, recorder, refreshPermissionState]);

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
    permissionState,
    start,
    stop,
    cancel,
    reset,
    setManualStopOnly,
    primePermission,
    refreshPermissionState,
    speak,
    stopSpeaking,
  };
}
