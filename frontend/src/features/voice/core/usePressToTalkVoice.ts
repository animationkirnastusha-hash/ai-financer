import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from './voiceApi';
import type { VoiceInputState, VoicePermissionState, VoiceStartResult } from './voiceCapture.types';
import { normalizeVoiceText } from './voiceText';

type UsePressToTalkVoiceParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  maxDurationMs?: number;
  minDurationMs?: number;
  source?: 'chat' | 'floating';
  permissionWasPrompted?: boolean;
  cancelSwipePx?: number;
};

type RecorderFormat = {
  mimeType: string;
  extension: string;
};

const DEFAULT_MAX_DURATION_MS = 9000;
const DEFAULT_MIN_DURATION_MS = 420;
const DEFAULT_CANCEL_SWIPE_PX = 64;
const TRANSCRIBE_TIMEOUT_MS = 34000;
const RECORDER_START_TIMEOUT_MS = 12000;

const RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'aac' },
];

function getRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return RECORDER_FORMATS.find((format) => {
    try {
      return MediaRecorder.isTypeSupported(format.mimeType);
    } catch {
      return false;
    }
  }) ?? null;
}

function getSttLanguage(lang: string) {
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

async function queryMicrophonePermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) return null;
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

function safeStopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // no-op
    }
  });
}

function getErrorCode(error: unknown) {
  if (error instanceof Error) return error.name || error.message;
  return 'unknown';
}

export function usePressToTalkVoice({
  onText,
  lang = 'ru-RU',
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  source = 'chat',
  permissionWasPrompted = false,
  cancelSwipePx = DEFAULT_CANCEL_SWIPE_PX,
}: UsePressToTalkVoiceParams) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<VoicePermissionState>('unknown');
  const [isPressed, setIsPressed] = useState(false);
  const [isCancelledBySwipe, setIsCancelledBySwipe] = useState(false);

  const onTextRef = useRef(onText);
  const stateRef = useRef<VoiceInputState>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const formatRef = useRef<RecorderFormat | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const startXRef = useRef(0);
  const startInFlightRef = useRef(false);
  const stopAfterStartRef = useRef(false);
  const cancelledRef = useRef(false);
  const finalizeBusyRef = useRef(false);
  const maxDurationTimerRef = useRef<number | null>(null);
  const startGuardTimerRef = useRef<number | null>(null);

  onTextRef.current = onText;

  const recorderFormat = useMemo(() => getRecorderFormat(), []);
  const isSupported = Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      recorderFormat,
  );

  const setVoiceState = useCallback((nextState: VoiceInputState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearTimers = useCallback(() => {
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (startGuardTimerRef.current !== null) {
      window.clearTimeout(startGuardTimerRef.current);
      startGuardTimerRef.current = null;
    }
  }, []);

  const cleanupRecorderRuntime = useCallback(() => {
    clearTimers();
    safeStopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    formatRef.current = null;
    startInFlightRef.current = false;
    stopAfterStartRef.current = false;
    cancelledRef.current = false;
    finalizeBusyRef.current = false;
    pointerIdRef.current = null;
    setIsPressed(false);
    setIsCancelledBySwipe(false);
  }, [clearTimers]);

  const refreshPermissionState = useCallback(async (): Promise<VoicePermissionState> => {
    if (!isSupported) {
      setPermissionState('unsupported');
      return 'unsupported';
    }

    const queried = await queryMicrophonePermissionState();
    if (queried) {
      setPermissionState(queried);
      return queried;
    }

    setPermissionState('unknown');
    return 'unknown';
  }, [isSupported]);

  useEffect(() => {
    void refreshPermissionState();
  }, [permissionWasPrompted, refreshPermissionState]);

  const reset = useCallback(() => {
    cleanupRecorderRuntime();
    setError(null);
    setVoiceState('idle');
  }, [cleanupRecorderRuntime, setVoiceState]);

  const cancel = useCallback((reason = 'cancelled') => {
    logVoiceDebugEvent('voice_cancel', { source, reason, state: stateRef.current });
    cancelledRef.current = true;
    stopAfterStartRef.current = false;
    setIsPressed(false);
    setIsCancelledBySwipe(false);

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupRecorderRuntime();
        setVoiceState('idle');
      }
      return;
    }

    cleanupRecorderRuntime();
    setVoiceState('idle');
  }, [cleanupRecorderRuntime, setVoiceState, source]);

  const finalizeBlob = useCallback(async (blob: Blob, format: RecorderFormat, durationMs: number) => {
    if (finalizeBusyRef.current) return;
    finalizeBusyRef.current = true;
    clearTimers();
    safeStopStream(streamRef.current);
    streamRef.current = null;

    if (cancelledRef.current) {
      cleanupRecorderRuntime();
      setVoiceState('idle');
      return;
    }

    if (durationMs < minDurationMs || blob.size < 800) {
      logVoiceDebugEvent('voice_blob_skipped', { source, durationMs, blobSize: blob.size });
      cleanupRecorderRuntime();
      setError('no-speech');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
      return;
    }

    logVoiceDebugEvent('voice_blob_ready', { source, durationMs, blobSize: blob.size, mimeType: format.mimeType });
    setVoiceState('uploading');

    try {
      logVoiceDebugEvent('voice_transcribe_sent', { source, blobSize: blob.size, language: getSttLanguage(lang) });
      const response = await transcribeVoice(blob, `voice.${format.extension}`, getSttLanguage(lang), TRANSCRIBE_TIMEOUT_MS);
      const text = normalizeVoiceText(response.text || '');
      logVoiceDebugEvent('voice_transcribe_success', { source, textLength: text.length, provider: response.provider, model: response.model });

      if (!text) {
        setError('no-speech');
        cleanupRecorderRuntime();
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 0);
        return;
      }

      logVoiceDebugEvent('voice_text_received', { source, textLength: text.length });
      await onTextRef.current(text);
      cleanupRecorderRuntime();
      setError(null);
      setVoiceState('idle');
    } catch (nextError) {
      const errorCode = (nextError as Error & { code?: string }).code || getErrorCode(nextError);
      logVoiceDebugEvent('voice_transcribe_failed', { source, error: errorCode });
      cleanupRecorderRuntime();
      setError(errorCode === 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT' ? 'transcription-timeout' : 'transcription-error');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
    }
  }, [cleanupRecorderRuntime, clearTimers, lang, minDurationMs, setVoiceState, source]);

  const stop = useCallback(() => {
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    logVoiceDebugEvent('voice_release', { source, state: stateRef.current, durationMs, deferred: startInFlightRef.current });
    setIsPressed(false);
    pointerIdRef.current = null;

    if (startInFlightRef.current && stateRef.current !== 'recording') {
      stopAfterStartRef.current = true;
      return;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupRecorderRuntime();
      setVoiceState('idle');
      return;
    }

    try {
      recorder.stop();
    } catch (error) {
      logVoiceDebugEvent('voice_stop_failed', { source, error: getErrorCode(error) });
      cleanupRecorderRuntime();
      setVoiceState('idle');
    }
  }, [cleanupRecorderRuntime, setVoiceState, source]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    if (!isSupported || !recorderFormat) {
      setPermissionState('unsupported');
      setError('unsupported');
      setVoiceState('error');
      return 'permission-ready';
    }

    if (stateRef.current === 'recording' || stateRef.current === 'uploading' || startInFlightRef.current) return 'busy';

    setError(null);
    startInFlightRef.current = true;
    stopAfterStartRef.current = false;
    cancelledRef.current = false;
    finalizeBusyRef.current = false;
    chunksRef.current = [];
    formatRef.current = recorderFormat;
    logVoiceDebugEvent('voice_permission_request', { source, mimeType: recorderFormat.mimeType });

    startGuardTimerRef.current = window.setTimeout(() => {
      if (!startInFlightRef.current) return;
      logVoiceDebugEvent('voice_start_guard_timeout', { source });
      cancel('start-timeout');
      setError('microphone-timeout');
    }, RECORDER_START_TIMEOUT_MS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      setPermissionState('granted');
      logVoiceDebugEvent('voice_permission_granted', { source, tracks: stream.getAudioTracks().length });

      const recorder = new MediaRecorder(stream, { mimeType: recorderFormat.mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        logVoiceDebugEvent('voice_recorder_error', { source, error: String((event as ErrorEvent).message || 'recorder-error') });
        setError('recorder-error');
      };

      recorder.onstop = () => {
        const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
        logVoiceDebugEvent('voice_recorder_stopped', { source, durationMs, chunks: chunksRef.current.length });
        const blob = new Blob(chunksRef.current, { type: recorderFormat.mimeType });
        void finalizeBlob(blob, recorderFormat, durationMs);
      };

      startedAtRef.current = Date.now();
      recorder.start();
      startInFlightRef.current = false;
      if (startGuardTimerRef.current !== null) {
        window.clearTimeout(startGuardTimerRef.current);
        startGuardTimerRef.current = null;
      }
      setVoiceState('recording');
      logVoiceDebugEvent('voice_recorder_started', { source, mimeType: recorderFormat.mimeType });

      maxDurationTimerRef.current = window.setTimeout(() => {
        logVoiceDebugEvent('voice_auto_stop', { source, maxDurationMs });
        stop();
      }, Math.max(1200, maxDurationMs));

      if (stopAfterStartRef.current) {
        stopAfterStartRef.current = false;
        window.setTimeout(() => stop(), 0);
      }

      return 'started';
    } catch (nextError) {
      startInFlightRef.current = false;
      if (startGuardTimerRef.current !== null) {
        window.clearTimeout(startGuardTimerRef.current);
        startGuardTimerRef.current = null;
      }
      safeStopStream(streamRef.current);
      streamRef.current = null;

      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_permission_denied', { source, error: errorCode });
      const permission = await queryMicrophonePermissionState();
      setPermissionState(permission ?? 'denied');
      setError(errorCode === 'NotAllowedError' ? 'microphone-denied' : 'microphone-error');
      setIsPressed(false);
      setVoiceState('error');
      return 'permission-ready';
    }
  }, [cancel, finalizeBlob, isSupported, maxDurationMs, recorderFormat, setVoiceState, source, stop]);

  const primePermission = useCallback(async () => {
    if (!isSupported) {
      setPermissionState('unsupported');
      setError('unsupported');
      return false;
    }

    try {
      const current = await queryMicrophonePermissionState();
      if (current === 'granted') {
        setPermissionState('granted');
        setError(null);
        return true;
      }

      logVoiceDebugEvent('voice_permission_request', { source, mode: 'prime' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      safeStopStream(stream);
      setPermissionState('granted');
      setError(null);
      logVoiceDebugEvent('voice_permission_granted', { source, mode: 'prime' });
      return true;
    } catch (nextError) {
      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_permission_denied', { source, mode: 'prime', error: errorCode });
      const permission = await queryMicrophonePermissionState();
      setPermissionState(permission ?? 'denied');
      setError(errorCode === 'NotAllowedError' ? 'microphone-denied' : 'microphone-error');
      return false;
    }
  }, [isSupported, source]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<Element>) => {
    if (stateRef.current === 'uploading' || startInFlightRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startedAtRef.current = Date.now();
    setIsPressed(true);
    setIsCancelledBySwipe(false);
    logVoiceDebugEvent('voice_press_start', { source, pointerId: event.pointerId, state: stateRef.current });
    (event.currentTarget as Element & { setPointerCapture?: (pointerId: number) => void }).setPointerCapture?.(event.pointerId);
    void start();
  }, [source, start]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<Element>) => {
    if (pointerIdRef.current !== event.pointerId || isCancelledBySwipe) return;
    const dx = event.clientX - startXRef.current;
    if (dx <= -Math.abs(cancelSwipePx)) {
      setIsCancelledBySwipe(true);
      cancel('swipe-left');
    }
  }, [cancel, cancelSwipePx, isCancelledBySwipe]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<Element>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    stop();
  }, [stop]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<Element>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    cancel('pointer-cancel');
  }, [cancel]);

  useEffect(() => {
    if (pointerIdRef.current === null && !isPressed) return;

    const release = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      stop();
    };

    const pointerCancel = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      cancel('window-pointer-cancel');
    };

    const blurCancel = () => cancel('window-blur');
    const pageHideCancel = () => cancel('pagehide');
    const visibilityCancel = () => {
      if (document.visibilityState === 'hidden') cancel('visibility-hidden');
    };

    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('blur', blurCancel);
    window.addEventListener('pagehide', pageHideCancel);
    document.addEventListener('visibilitychange', visibilityCancel);

    return () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('blur', blurCancel);
      window.removeEventListener('pagehide', pageHideCancel);
      document.removeEventListener('visibilitychange', visibilityCancel);
    };
  }, [cancel, isPressed, stop]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => () => {
    cleanupRecorderRuntime();
  }, [cleanupRecorderRuntime]);

  return {
    state,
    error,
    permissionState,
    isSupported,
    isPressed,
    isCancelledBySwipe,
    start,
    stop,
    cancel,
    reset,
    primePermission,
    refreshPermissionState,
    stopSpeaking,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
