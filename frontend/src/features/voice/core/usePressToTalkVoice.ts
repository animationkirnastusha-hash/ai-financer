import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from './voiceApi';
import type { VoiceInputState, VoicePermissionState, VoiceStartResult } from './voiceCapture.types';
import { normalizeVoiceText } from './voiceText';

export type UsePressToTalkVoiceParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  maxDurationMs?: number;
  sessionMs?: number;
  minDurationMs?: number;
  source?: 'chat' | 'floating';
  permissionWasPrompted?: boolean;
  cancelSwipePx?: number;
};

type RecorderPlatform = 'ios' | 'android' | 'desktop';

type RecorderFormat = {
  mimeType: string;
  extension: string;
};

type RecorderSession = {
  id: string;
  platform: RecorderPlatform;
  stream: MediaStream;
  recorder: MediaRecorder;
  requestedFormat: RecorderFormat;
  actualFormat: RecorderFormat;
  chunks: Blob[];
  startedAt: number;
  stopping: boolean;
  finalized: boolean;
  cancelled: boolean;
  stopGuardTimer: number | null;
};

const DEFAULT_MAX_DURATION_MS = 9000;
const DEFAULT_MIN_DURATION_MS = 350;
const DEFAULT_CANCEL_SWIPE_PX = 64;
const TRANSCRIBE_TIMEOUT_MS = 38000;
const RECORDER_START_TIMEOUT_MS = 12000;
const STOP_GUARD_TIMEOUT_MS = 3500;
const MIN_UPLOAD_BYTES = 512;

const IOS_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'aac' },
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: '', extension: 'm4a' },
];

const ANDROID_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: '', extension: 'webm' },
];

const DESKTOP_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: '', extension: 'webm' },
];

const IOS_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 44100 },
  sampleSize: { ideal: 16 },
};

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};

function getRecorderPlatform(): RecorderPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const userAgent = navigator.userAgent.toLowerCase();
  const isIPadDesktopMode = userAgent.includes('macintosh') && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(userAgent) || isIPadDesktopMode) return 'ios';
  if (userAgent.includes('android')) return 'android';
  return 'desktop';
}

function getPlatformFormats(platform: RecorderPlatform) {
  if (platform === 'ios') return IOS_FORMATS;
  if (platform === 'android') return ANDROID_FORMATS;
  return DESKTOP_FORMATS;
}

function getAudioConstraints(platform: RecorderPlatform): MediaTrackConstraints {
  return platform === 'ios' ? IOS_AUDIO_CONSTRAINTS : DEFAULT_AUDIO_CONSTRAINTS;
}

function canUseMimeType(mimeType: string) {
  if (!mimeType) return true;
  if (typeof MediaRecorder === 'undefined') return false;
  try {
    return MediaRecorder.isTypeSupported(mimeType);
  } catch {
    return false;
  }
}

function selectRecorderFormat(platform: RecorderPlatform): RecorderFormat | null {
  return getPlatformFormats(platform).find((format) => canUseMimeType(format.mimeType)) ?? null;
}

function normalizeMimeType(mimeType: string) {
  return mimeType.toLowerCase().split(';')[0].trim();
}

function isContainerThatMustNotBeTimesliced(mimeType: string) {
  const normalized = normalizeMimeType(mimeType);
  return normalized.includes('mp4') || normalized.includes('m4a') || normalized.includes('aac') || normalized.includes('caf');
}

function getExtensionFromMimeType(mimeType: string, fallbackExtension: string) {
  const normalized = normalizeMimeType(mimeType);
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('aac')) return 'aac';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('caf')) return 'caf';
  if (normalized.includes('webm')) return 'webm';
  return fallbackExtension || 'webm';
}

function resolveActualFormat(recorder: MediaRecorder, requestedFormat: RecorderFormat): RecorderFormat {
  const actualMimeType = recorder.mimeType || requestedFormat.mimeType || 'audio/webm';
  return {
    mimeType: actualMimeType,
    extension: getExtensionFromMimeType(actualMimeType, requestedFormat.extension),
  };
}

function createRecorder(stream: MediaStream, format: RecorderFormat): MediaRecorder {
  if (!format.mimeType) return new MediaRecorder(stream);
  try {
    return new MediaRecorder(stream, { mimeType: format.mimeType });
  } catch {
    return new MediaRecorder(stream);
  }
}

function startRecorderSafely(recorder: MediaRecorder, format: RecorderFormat) {
  const mimeType = recorder.mimeType || format.mimeType;
  if (isContainerThatMustNotBeTimesliced(mimeType)) {
    recorder.start();
    return { timesliceMs: 0 };
  }

  recorder.start(1000);
  return { timesliceMs: 1000 };
}

function stopStream(stream: MediaStream | null) {
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

function createSessionId(source: string) {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePressToTalkVoice({
  onText,
  lang = 'ru-RU',
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  sessionMs,
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

  const stateRef = useRef<VoiceInputState>('idle');
  const onTextRef = useRef(onText);
  const sessionRef = useRef<RecorderSession | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const pressStartedAtRef = useRef(0);
  const startInFlightRef = useRef(false);
  const stopAfterStartRef = useRef(false);
  const startGuardTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const releaseHandledRef = useRef(false);

  onTextRef.current = onText;

  const platform = useMemo(() => getRecorderPlatform(), []);
  const selectedFormat = useMemo(() => {
    if (typeof MediaRecorder === 'undefined') return null;
    return selectRecorderFormat(platform);
  }, [platform]);
  const isSupported = Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      selectedFormat,
  );
  const effectiveMaxDurationMs = sessionMs ?? maxDurationMs;

  const setVoiceState = useCallback((nextState: VoiceInputState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearTimers = useCallback(() => {
    if (startGuardTimerRef.current !== null) {
      window.clearTimeout(startGuardTimerRef.current);
      startGuardTimerRef.current = null;
    }
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    const session = sessionRef.current;
    if (session?.stopGuardTimer !== null && session?.stopGuardTimer !== undefined) {
      window.clearTimeout(session.stopGuardTimer);
      session.stopGuardTimer = null;
    }
  }, []);

  const cleanupRuntime = useCallback(() => {
    clearTimers();
    const session = sessionRef.current;
    if (session) {
      stopStream(session.stream);
      session.chunks = [];
      sessionRef.current = null;
    }
    startInFlightRef.current = false;
    stopAfterStartRef.current = false;
    pointerIdRef.current = null;
    releaseHandledRef.current = false;
    setIsPressed(false);
    setIsCancelledBySwipe(false);
  }, [clearTimers]);

  const refreshPermissionState = useCallback(async (): Promise<VoicePermissionState> => {
    if (!isSupported) {
      setPermissionState('unsupported');
      return 'unsupported';
    }

    const queried = await queryMicrophonePermissionState();
    const nextState: VoicePermissionState = queried ?? 'unknown';
    setPermissionState(nextState);
    return nextState;
  }, [isSupported]);

  useEffect(() => {
    void refreshPermissionState();
  }, [permissionWasPrompted, refreshPermissionState]);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (session?.recorder && session.recorder.state !== 'inactive') {
      session.cancelled = true;
      try {
        session.recorder.stop();
      } catch {
        // no-op
      }
    }
    cleanupRuntime();
    setError(null);
    setVoiceState('idle');
  }, [cleanupRuntime, setVoiceState]);

  const finalizeSession = useCallback(async (session: RecorderSession, reason = 'stop') => {
    if (session.finalized) return;
    session.finalized = true;
    clearTimers();
    stopStream(session.stream);

    const durationMs = Math.max(0, Date.now() - session.startedAt);
    const blobType = session.actualFormat.mimeType || session.requestedFormat.mimeType || 'audio/webm';
    const blob = new Blob(session.chunks, { type: blobType });

    logVoiceDebugEvent('voice_recorder_stopped', {
      source,
      sessionId: session.id,
      platform: session.platform,
      durationMs,
      chunks: session.chunks.length,
      blobSize: blob.size,
      blobType: blob.type || 'unknown',
      reason,
    });

    if (session.cancelled) {
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    if (durationMs < minDurationMs || blob.size < MIN_UPLOAD_BYTES) {
      logVoiceDebugEvent('voice_blob_skipped', {
        source,
        sessionId: session.id,
        durationMs,
        blobSize: blob.size,
        reason: durationMs < minDurationMs ? 'too-short' : 'too-small',
      });
      cleanupRuntime();
      setError('no-speech');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
      return;
    }

    setVoiceState('uploading');
    setError(null);
    const filename = `voice-${session.id}.${session.actualFormat.extension}`;

    try {
      logVoiceDebugEvent('voice_blob_ready', {
        source,
        sessionId: session.id,
        platform: session.platform,
        durationMs,
        blobSize: blob.size,
        blobType: blob.type || 'unknown',
        mimeType: blob.type || 'unknown',
        filename,
      });

      const response = await transcribeVoice(blob, filename, getSttLanguage(lang), TRANSCRIBE_TIMEOUT_MS);
      const text = normalizeVoiceText(response.text || '');

      if (!text) {
        logVoiceDebugEvent('voice_text_empty', { source, sessionId: session.id, provider: response.provider, model: response.model });
        cleanupRuntime();
        setError('no-speech');
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 0);
        return;
      }

      logVoiceDebugEvent('voice_text_received', {
        source,
        sessionId: session.id,
        textLength: text.length,
        provider: response.provider,
        model: response.model,
      });

      await onTextRef.current(text);
      cleanupRuntime();
      setError(null);
      setVoiceState('idle');
    } catch (nextError) {
      const errorCode = (nextError as Error & { code?: string }).code || getErrorCode(nextError);
      logVoiceDebugEvent('voice_error', { source, sessionId: session.id, error: errorCode });
      cleanupRuntime();
      setError(errorCode === 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT' ? 'transcription-timeout' : 'transcription-error');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
    }
  }, [cleanupRuntime, clearTimers, lang, minDurationMs, setVoiceState, source]);

  const cancel = useCallback((reason = 'cancelled') => {
    logVoiceDebugEvent('voice_cancelled', { source, reason, state: stateRef.current });
    const session = sessionRef.current;
    stopAfterStartRef.current = false;
    setIsPressed(false);
    setIsCancelledBySwipe(false);

    if (session?.recorder && session.recorder.state !== 'inactive') {
      session.cancelled = true;
      try {
        session.recorder.stop();
        return;
      } catch {
        // fall through to cleanup
      }
    }

    cleanupRuntime();
    setVoiceState('idle');
  }, [cleanupRuntime, setVoiceState, source]);

  const stop = useCallback(() => {
    if (releaseHandledRef.current) return;
    releaseHandledRef.current = true;
    setIsPressed(false);

    const durationMs = pressStartedAtRef.current ? Date.now() - pressStartedAtRef.current : 0;
    logVoiceDebugEvent('voice_release', { source, state: stateRef.current, durationMs, deferred: startInFlightRef.current });

    if (startInFlightRef.current && stateRef.current !== 'recording') {
      stopAfterStartRef.current = true;
      return;
    }

    const session = sessionRef.current;
    if (!session?.recorder || session.recorder.state === 'inactive') {
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    if (session.stopping) return;
    session.stopping = true;

    try {
      session.stopGuardTimer = window.setTimeout(() => {
        if (!session.finalized) {
          logVoiceDebugEvent('voice_stop_guard_finalize', { source, sessionId: session.id, chunks: session.chunks.length });
          void finalizeSession(session, 'stop-guard');
        }
      }, STOP_GUARD_TIMEOUT_MS);
      session.recorder.stop();
    } catch (nextError) {
      logVoiceDebugEvent('voice_error', { source, error: getErrorCode(nextError), stage: 'stop' });
      void finalizeSession(session, 'stop-error');
    }
  }, [cleanupRuntime, finalizeSession, setVoiceState, source]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    if (!isSupported || !selectedFormat) {
      setPermissionState('unsupported');
      setError('unsupported');
      setVoiceState('error');
      return 'permission-ready';
    }

    if (stateRef.current === 'recording' || stateRef.current === 'uploading' || startInFlightRef.current) return 'busy';

    window.speechSynthesis?.cancel();
    setError(null);
    startInFlightRef.current = true;
    stopAfterStartRef.current = false;
    releaseHandledRef.current = false;

    const sessionId = createSessionId(source);
    logVoiceDebugEvent('voice_start_requested', {
      source,
      sessionId,
      platform,
      mimeType: selectedFormat.mimeType || 'default',
      extension: selectedFormat.extension,
    });

    startGuardTimerRef.current = window.setTimeout(() => {
      if (!startInFlightRef.current) return;
      logVoiceDebugEvent('voice_error', { source, sessionId, error: 'start-timeout', stage: 'start' });
      cancel('start-timeout');
      setError('microphone-timeout');
    }, RECORDER_START_TIMEOUT_MS);

    let acquiredStream: MediaStream | null = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints(platform) });
      acquiredStream = stream;
      setPermissionState('granted');
      logVoiceDebugEvent('voice_permission_granted', { source, sessionId, platform, audioTracks: stream.getAudioTracks().length });

      const recorder = createRecorder(stream, selectedFormat);
      const actualFormat = resolveActualFormat(recorder, selectedFormat);
      const session: RecorderSession = {
        id: sessionId,
        platform,
        stream,
        recorder,
        requestedFormat: selectedFormat,
        actualFormat,
        chunks: [],
        startedAt: Date.now(),
        stopping: false,
        finalized: false,
        cancelled: false,
        stopGuardTimer: null,
      };

      sessionRef.current = session;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          session.chunks.push(event.data);
          logVoiceDebugEvent('voice_data_chunk', {
            source,
            sessionId,
            chunks: session.chunks.length,
            blobSize: event.data.size,
            blobType: event.data.type || actualFormat.mimeType || 'unknown',
          });
        }
      };

      recorder.onerror = (event) => {
        const message = String((event as ErrorEvent).message || 'recorder-error');
        logVoiceDebugEvent('voice_error', { source, sessionId, error: message, stage: 'recorder' });
        setError('recorder-error');
      };

      recorder.onstop = () => {
        window.setTimeout(() => {
          void finalizeSession(session, 'recorder-stop');
        }, 40);
      };

      const startInfo = startRecorderSafely(recorder, selectedFormat);
      startInFlightRef.current = false;
      if (startGuardTimerRef.current !== null) {
        window.clearTimeout(startGuardTimerRef.current);
        startGuardTimerRef.current = null;
      }

      setVoiceState('recording');
      logVoiceDebugEvent('voice_recorder_started', {
        source,
        sessionId,
        platform,
        mimeType: actualFormat.mimeType || 'unknown',
        extension: actualFormat.extension,
        sessionMs: effectiveMaxDurationMs,
        chunks: 0,
        timesliceMs: startInfo.timesliceMs,
      });

      maxDurationTimerRef.current = window.setTimeout(() => {
        logVoiceDebugEvent('voice_auto_stop', { source, sessionId, maxDurationMs: effectiveMaxDurationMs });
        releaseHandledRef.current = false;
        stop();
      }, Math.max(1200, effectiveMaxDurationMs));

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
      stopStream(acquiredStream);
      cleanupRuntime();

      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_error', { source, sessionId, error: errorCode, stage: 'permission' });
      const permission = await queryMicrophonePermissionState();
      setPermissionState(permission ?? 'denied');
      setError(errorCode === 'NotAllowedError' ? 'microphone-denied' : 'microphone-error');
      setVoiceState('error');
      return 'permission-ready';
    }
  }, [cancel, cleanupRuntime, effectiveMaxDurationMs, finalizeSession, isSupported, platform, selectedFormat, setVoiceState, source, stop]);

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

      logVoiceDebugEvent('voice_permission_requested', { source, mode: 'prime', platform });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints(platform) });
      stopStream(stream);
      setPermissionState('granted');
      setError(null);
      logVoiceDebugEvent('voice_permission_granted', { source, mode: 'prime', platform });
      return true;
    } catch (nextError) {
      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_error', { source, mode: 'prime', platform, error: errorCode, stage: 'permission' });
      const permission = await queryMicrophonePermissionState();
      setPermissionState(permission ?? 'denied');
      setError(errorCode === 'NotAllowedError' ? 'microphone-denied' : 'microphone-error');
      return false;
    }
  }, [isSupported, platform, source]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<Element>) => {
    if (stateRef.current === 'uploading' || startInFlightRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    pressStartedAtRef.current = Date.now();
    releaseHandledRef.current = false;
    setIsPressed(true);
    setIsCancelledBySwipe(false);
    logVoiceDebugEvent('voice_press_start', { source, pointerId: event.pointerId, state: stateRef.current, platform });
    (event.currentTarget as Element & { setPointerCapture?: (pointerId: number) => void }).setPointerCapture?.(event.pointerId);
    void start();
  }, [platform, source, start]);

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

    const releaseFromPointer = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      stop();
    };

    const releaseFromTouchOrMouse = () => {
      if (!isPressed && pointerIdRef.current === null) return;
      stop();
    };

    const pointerCancel = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      cancel('window-pointer-cancel');
    };

    const touchCancel = () => cancel('window-touch-cancel');
    const blurCancel = () => cancel('window-blur');
    const pageHideCancel = () => cancel('pagehide');
    const visibilityCancel = () => {
      if (document.visibilityState === 'hidden') cancel('visibility-hidden');
    };

    window.addEventListener('pointerup', releaseFromPointer, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('mouseup', releaseFromTouchOrMouse, true);
    window.addEventListener('touchend', releaseFromTouchOrMouse, true);
    window.addEventListener('touchcancel', touchCancel, true);
    window.addEventListener('blur', blurCancel);
    window.addEventListener('pagehide', pageHideCancel);
    document.addEventListener('visibilitychange', visibilityCancel);

    return () => {
      window.removeEventListener('pointerup', releaseFromPointer, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('mouseup', releaseFromTouchOrMouse, true);
      window.removeEventListener('touchend', releaseFromTouchOrMouse, true);
      window.removeEventListener('touchcancel', touchCancel, true);
      window.removeEventListener('blur', blurCancel);
      window.removeEventListener('pagehide', pageHideCancel);
      document.removeEventListener('visibilitychange', visibilityCancel);
    };
  }, [cancel, isPressed, stop]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => () => {
    cleanupRuntime();
  }, [cleanupRuntime]);

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
