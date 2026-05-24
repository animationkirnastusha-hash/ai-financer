import { useCallback, useMemo, useRef, useState } from 'react';
import { getVoiceCueAudio, logVoiceDebugEvent, type VoiceCue } from '@/features/voice/api/voice.api';
import { useVoiceRecognition } from '@/features/voice/model/useVoiceRecognition';
import { useVoiceRecorder } from '@/features/voice/model/useVoiceRecorder';
import type {
  VoiceInputMode,
  VoiceInputState,
} from '@/features/voice/model/voice.types';

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

export function useVoiceInput({
  onText,
  lang = 'ru-RU',
  sessionMs = 8500,
}: UseVoiceInputParams) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackSeqRef = useRef(0);
  const [permissionPrimed, setPermissionPrimed] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const permissionRequestInFlightRef = useRef(false);

  const recorder = useVoiceRecorder({
    onText,
    lang,
    chunkMs: sessionMs,
  });

  // Web Speech stays only as a last-resort desktop/dev fallback. The product path is one-shot server STT.
  const speech = useVoiceRecognition({
    lang,
    onFinalText: onText,
  });

  const stopCurrentAudio = useCallback(() => {
    playbackSeqRef.current += 1;

    const currentAudio = audioRef.current;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  const unlockAudioPlayback = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;

      if (context.state === 'suspended') {
        void context.resume().catch((error) => {
          logVoiceDebugEvent('tts_audio_unlock_failed', {
            error: error instanceof Error ? error.name || error.message : 'unknown',
          });
        });
      }

      logVoiceDebugEvent('tts_audio_unlock_ready', { state: context.state });
    } catch (error) {
      logVoiceDebugEvent('tts_audio_unlock_failed', {
        error: error instanceof Error ? error.name || error.message : 'unknown',
      });
    }
  }, []);

  const mode = useMemo<VoiceInputMode>(() => {
    return recorder.isSupported ? 'recorder' : 'speech';
  }, [recorder.isSupported]);

  const primePermission = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (permissionPrimed) return true;
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setPermissionPrimed(true);
      return true;
    }

    await getMicrophonePermissionState();

    if (permissionRequestInFlightRef.current) return false;
    permissionRequestInFlightRef.current = true;
    logVoiceDebugEvent('permission_prime_requested');
    unlockAudioPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      unlockAudioPlayback();
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
  }, [permissionPrimed, unlockAudioPlayback]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    window.speechSynthesis?.cancel();
    unlockAudioPlayback();
    setPermissionError(null);

    if (mode === 'recorder' && (recorder.state === 'recording' || recorder.state === 'uploading')) return 'busy';
    if (mode === 'speech' && speech.state !== 'idle') return 'busy';

    try {
      const permissionReady = await primePermission();
      if (!permissionReady) return 'permission-ready';

      if (mode === 'recorder') {
        await recorder.startRecording();
        return 'started';
      }

      if (speech.isSupported) {
        return speech.startListening() ? 'started' : 'permission-ready';
      }

      return 'error';
    } catch (err) {
      console.error(err);
      return 'error';
    }
  }, [mode, primePermission, recorder, speech, unlockAudioPlayback]);

  const stop = useCallback(() => {
    if (mode === 'recorder') {
      recorder.stopRecording();
      return;
    }

    speech.stopListening();
  }, [mode, recorder, speech]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopCurrentAudio();
    setPermissionError(null);
    recorder.cancelRecording();
    speech.cancelListening();
  }, [recorder, speech, stopCurrentAudio]);

  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopCurrentAudio();
    setPermissionError(null);
    recorder.reset();
    speech.reset();
  }, [recorder, speech, stopCurrentAudio]);

  const speak = useCallback((text: string, options?: { maxDurationMs?: number; cue?: VoiceCue }) => {
    const cue = options?.cue;
    if (!cue) return;

    window.speechSynthesis?.cancel();
    stopCurrentAudio();

    const requestSeq = playbackSeqRef.current + 1;
    playbackSeqRef.current = requestSeq;
    setIsSpeaking(true);

    void getVoiceCueAudio(cue)
      .then((blob) => {
        if (playbackSeqRef.current !== requestSeq) {
          logVoiceDebugEvent('tts_playback_discarded_stale', { code: cue, textLength: text.length });
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = 1;
        audioRef.current = audio;
        audioUrlRef.current = url;

        const cleanup = () => {
          if (audioRef.current === audio) audioRef.current = null;
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }
          if (playbackSeqRef.current === requestSeq) setIsSpeaking(false);
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;
        void audio.play().then(() => {
          if (playbackSeqRef.current !== requestSeq) {
            audio.pause();
            cleanup();
            return;
          }
          logVoiceDebugEvent('tts_playback_started', { code: cue, textLength: text.length });
        }).catch((error) => {
          logVoiceDebugEvent('tts_playback_failed', {
            error: error instanceof Error ? error.name || error.message : 'unknown',
            code: cue,
          });
          cleanup();
        });

        if (options?.maxDurationMs) {
          window.setTimeout(() => {
            if (audioRef.current === audio && playbackSeqRef.current === requestSeq) {
              audio.pause();
              cleanup();
            }
          }, Math.max(700, options.maxDurationMs));
        }
      })
      .catch((error) => {
        if (playbackSeqRef.current !== requestSeq) return;
        logVoiceDebugEvent('tts_request_failed', {
          error: error instanceof Error ? error.name || error.message : 'unknown',
          code: typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : cue,
          status: typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0,
          textLength: text.length,
        });
        setIsSpeaking(false);
      });
  }, [stopCurrentAudio]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopCurrentAudio();
  }, [stopCurrentAudio]);

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
    primePermission,
    speak,
    stopSpeaking,
  };
}
