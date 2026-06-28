import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from './voiceApi';
import type { MicrophonePermissionState, VoiceCue, VoiceInputState, VoiceStartResult } from './voiceTypes';

type UsePressToTalkVoiceParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
  permissionWasPrompted?: boolean;
};

type RecorderFormat = {
  mimeType: string;
  extension: string;
};

const DEFAULT_SESSION_MS = 15_000;
const MAX_RECORDING_MS = 24_000;
const MIN_UPLOAD_BYTES = 64;
const TRANSCRIBE_TIMEOUT_MS = 38_000;

const RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'aac' },
  { mimeType: '', extension: 'webm' },
];

function getSttLanguage(lang: string) {
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

function getRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null;

  for (const format of RECORDER_FORMATS) {
    if (!format.mimeType) return format;
    try {
      if (MediaRecorder.isTypeSupported(format.mimeType)) return format;
    } catch {
      // Keep scanning.
    }
  }

  return null;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore cleanup errors
    }
  });
}

async function queryMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined') return 'unknown';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  if (!('permissions' in navigator)) return 'unknown';

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

function createVoiceErrorCode(error: unknown) {
  if (!(error instanceof Error)) return 'voice-error';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'microphone-denied';
  if (error.name === 'NotFoundError') return 'microphone-not-found';
  if (error.name === 'NotReadableError') return 'microphone-busy';
  if (error.name === 'AbortError') return 'microphone-aborted';
  return error.message || error.name || 'voice-error';
}

export function usePressToTalkVoice({
  onText,
  lang = 'ru-RU',
  sessionMs = DEFAULT_SESSION_MS,
}: UsePressToTalkVoiceParams) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const formatRef = useRef<RecorderFormat | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const pendingStopRef = useRef(false);
  const finalizingRef = useRef(false);
  const autoStopTimerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);

  const [state, setState] = useState<VoiceInputState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');

  onTextRef.current = onText;

  const recorderFormat = useMemo(() => getRecorderFormat(), []);
  const isSupported = Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      recorderFormat,
  );

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback((nextState: VoiceInputState = 'idle') => {
    clearAutoStopTimer();
    stopTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    formatRef.current = null;
    sessionIdRef.current = null;
    startedAtRef.current = 0;
    pendingStopRef.current = false;
    finalizingRef.current = false;
    cancelledRef.current = false;
    setState(nextState);
  }, [clearAutoStopTimer]);

  const refreshPermissionState = useCallback(async () => {
    const next = await queryMicrophonePermissionState();
    setPermissionState(next);
    logVoiceDebugEvent('voice_permission_state', { permissionState: next });
    return next;
  }, []);

  const uploadBlob = useCallback(async (blob: Blob, format: RecorderFormat, sessionId: string) => {
    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_upload_skipped_cancelled', { sessionId, blobSize: blob.size });
      cleanup('idle');
      return;
    }

    if (blob.size < MIN_UPLOAD_BYTES) {
      setError('no-speech');
      logVoiceDebugEvent('voice_upload_skipped_empty_blob', { sessionId, blobSize: blob.size });
      cleanup('error');
      window.setTimeout(() => setState('idle'), 0);
      return;
    }

    setState('uploading');
    setError(null);

    try {
      const filename = `voice-${sessionId}.${format.extension}`;
      const result = await transcribeVoice(blob, filename, getSttLanguage(lang), TRANSCRIBE_TIMEOUT_MS);
      const text = result.text?.trim() ?? '';

      if (!text) {
        setError('no-speech');
        logVoiceDebugEvent('voice_text_empty', { sessionId, blobSize: blob.size });
        cleanup('error');
        window.setTimeout(() => setState('idle'), 0);
        return;
      }

      logVoiceDebugEvent('voice_text_received', { sessionId, textLength: text.length });
      await onTextRef.current(text);
      cleanup('idle');
    } catch (uploadError) {
      const code = createVoiceErrorCode(uploadError);
      setError(code);
      logVoiceDebugEvent('voice_error', { sessionId, stage: 'upload', code });
      cleanup('error');
      window.setTimeout(() => setState('idle'), 0);
    }
  }, [cleanup, lang]);

  const finalizeRecorder = useCallback((sessionId: string) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    clearAutoStopTimer();

    const format = formatRef.current ?? recorderFormat ?? { mimeType: '', extension: 'webm' };
    const blobType = format.mimeType || (chunksRef.current[0] instanceof Blob ? chunksRef.current[0].type : '') || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: blobType });
    const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);

    logVoiceDebugEvent('voice_blob_ready', {
      sessionId,
      blobSize: blob.size,
      blobType,
      elapsedMs,
    });

    void uploadBlob(blob, format, sessionId);
  }, [clearAutoStopTimer, recorderFormat, uploadBlob]);

  const stop = useCallback(() => {
    logVoiceDebugEvent('voice_stop_requested', { state, hasRecorder: Boolean(recorderRef.current) });
    pendingStopRef.current = true;

    const recorder = recorderRef.current;
    if (!recorder) {
      setState((current: VoiceInputState) => (current === 'recording' ? 'idle' : current));
      return;
    }

    try {
      if (recorder.state === 'recording' || recorder.state === 'paused') {
        recorder.stop();
        return;
      }
    } catch (stopError) {
      const code = createVoiceErrorCode(stopError);
      setError(code);
      logVoiceDebugEvent('voice_error', { stage: 'stop', code });
      cleanup('error');
      window.setTimeout(() => setState('idle'), 0);
    }
  }, [cleanup, state]);

  const cancel = useCallback(() => {
    logVoiceDebugEvent('voice_cancelled', { state, hasRecorder: Boolean(recorderRef.current) });
    cancelledRef.current = true;
    pendingStopRef.current = false;

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanup('idle');
      }
      return;
    }

    cleanup('idle');
  }, [cleanup, state]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    if (!isSupported || !recorderFormat) {
      setError('unsupported');
      setPermissionState('unsupported');
      logVoiceDebugEvent('voice_error', { stage: 'support', code: 'unsupported' });
      setState('error');
      window.setTimeout(() => setState('idle'), 0);
      return 'error';
    }

    if (recorderRef.current || state === 'recording' || state === 'uploading') {
      logVoiceDebugEvent('voice_start_busy', { state });
      return 'busy';
    }

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    cancelledRef.current = false;
    pendingStopRef.current = false;
    finalizingRef.current = false;
    chunksRef.current = [];
    formatRef.current = recorderFormat;
    setError(null);
    setState('recording');

    logVoiceDebugEvent('voice_start_requested', {
      sessionId,
      mimeType: recorderFormat.mimeType || 'default',
      extension: recorderFormat.extension,
    });

    try {
      logVoiceDebugEvent('voice_permission_requested', { sessionId });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setPermissionState('granted');
      logVoiceDebugEvent('voice_permission_granted', {
        sessionId,
        audioTracks: stream.getAudioTracks().length,
      });

      if (cancelledRef.current) {
        cleanup('idle');
        return 'started';
      }

      const options = recorderFormat.mimeType ? { mimeType: recorderFormat.mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        const code = createVoiceErrorCode((event as ErrorEvent).error || event);
        setError(code);
        logVoiceDebugEvent('voice_error', { sessionId, stage: 'recorder', code });
      };

      recorder.onstop = () => {
        logVoiceDebugEvent('voice_recorder_stopped', {
          sessionId,
          chunks: chunksRef.current.length,
          elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
        });
        stopTracks(streamRef.current);
        streamRef.current = null;
        finalizeRecorder(sessionId);
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setState('recording');
      logVoiceDebugEvent('voice_recorder_started', {
        sessionId,
        mimeType: recorderFormat.mimeType || 'default',
        extension: recorderFormat.extension,
      });

      clearAutoStopTimer();
      autoStopTimerRef.current = window.setTimeout(() => {
        logVoiceDebugEvent('voice_auto_stop', { sessionId });
        stop();
      }, Math.min(Math.max(sessionMs, 1200), MAX_RECORDING_MS));

      if (pendingStopRef.current) {
        window.setTimeout(() => stop(), 120);
      }

      return 'started';
    } catch (startError) {
      const code = createVoiceErrorCode(startError);
      setError(code);
      if (code === 'microphone-denied') setPermissionState('denied');
      logVoiceDebugEvent('voice_error', { sessionId, stage: 'start', code });
      cleanup('error');
      window.setTimeout(() => setState('idle'), 0);
      return 'error';
    }
  }, [cleanup, clearAutoStopTimer, finalizeRecorder, isSupported, recorderFormat, sessionMs, state, stop]);

  const primePermission = useCallback(async () => {
    if (!isSupported) {
      setPermissionState('unsupported');
      setError('unsupported');
      return false;
    }

    try {
      logVoiceDebugEvent('voice_permission_requested', { source: 'prime' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stopTracks(stream);
      setPermissionState('granted');
      logVoiceDebugEvent('voice_permission_granted', { source: 'prime' });
      return true;
    } catch (primeError) {
      const code = createVoiceErrorCode(primeError);
      setError(code);
      if (code === 'microphone-denied') setPermissionState('denied');
      logVoiceDebugEvent('voice_error', { source: 'prime', code });
      return false;
    }
  }, [isSupported]);

  const reset = useCallback(() => {
    setError(null);
    cleanup('idle');
  }, [cleanup]);

  const speak = useCallback((_text: string, _options?: { maxDurationMs?: number; cue?: VoiceCue }) => {
    // TTS is intentionally not handled by the recording layer.
  }, []);

  const stopSpeaking = useCallback(() => {
    // TTS is intentionally not handled by the recording layer.
  }, []);

  useEffect(() => {
    void refreshPermissionState();
  }, [refreshPermissionState]);

  useEffect(() => () => {
    cancelledRef.current = true;
    cleanup('idle');
  }, [cleanup]);

  return {
    state,
    error,
    mode: 'recorder' as const,
    isSupported,
    permissionState,
    start,
    stop,
    cancel,
    reset,
    resetCapture: reset,
    primePermission,
    refreshPermissionState,
    speak,
    stopSpeaking,
  };
}
