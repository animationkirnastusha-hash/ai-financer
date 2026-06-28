import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from './voiceApi';
import type { VoiceInputState, VoicePermissionState, VoiceStartResult } from './voiceCapture.types';
import { normalizeVoiceText } from './voiceText';

type UsePressToTalkVoiceParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  maxDurationMs?: number;
  sessionMs?: number;
  minDurationMs?: number;
  source?: 'chat' | 'floating';
  permissionWasPrompted?: boolean;
  cancelSwipePx?: number;
};

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type WavRecorderRuntime = {
  sessionId: string;
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: ScriptProcessorNode;
  silentGain: GainNode;
  inputSampleRate: number;
  chunks: Float32Array[];
};

const DEFAULT_MAX_DURATION_MS = 9000;
const DEFAULT_MIN_DURATION_MS = 160;
const DEFAULT_CANCEL_SWIPE_PX = 64;
const TRANSCRIBE_TIMEOUT_MS = 38000;
const START_TIMEOUT_MS = 12000;
const TARGET_SAMPLE_RATE = 16000;
const MIN_UPLOAD_BYTES = 256;

let activeVoiceSessionId: string | null = null;

function createSessionId(source: string) {
  return `${source}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSttLanguage(lang: string) {
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

function getErrorCode(error: unknown) {
  if (error instanceof Error) return error.name || error.message;
  return 'unknown';
}

function getAudioContextCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext || null;
}

function isVoiceSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      getAudioContextCtor(),
  );
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

function mergeFloat32(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function resampleLinear(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate === outputSampleRate) return input;
  if (!input.length) return input;

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const weight = sourceIndex - leftIndex;
    output[index] = input[leftIndex] * (1 - weight) + input[rightIndex] * weight;
  }

  return output;
}

function floatTo16BitPcm(view: DataView, offset: number, input: Float32Array) {
  let cursor = offset;
  for (let index = 0; index < input.length; index += 1, cursor += 2) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(cursor, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(chunks: Float32Array[], inputSampleRate: number) {
  const merged = mergeFloat32(chunks);
  const samples = resampleLinear(merged, inputSampleRate, TARGET_SAMPLE_RATE);
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  floatTo16BitPcm(view, 44, samples);

  return {
    blob: new Blob([buffer], { type: 'audio/wav' }),
    inputSampleRate,
    outputSampleRate: TARGET_SAMPLE_RATE,
    sampleCount: samples.length,
  };
}

function disconnectRuntime(runtime: WavRecorderRuntime | null) {
  if (!runtime) return;

  try {
    runtime.processorNode.onaudioprocess = null;
    runtime.processorNode.disconnect();
  } catch {
    // no-op
  }

  try {
    runtime.sourceNode.disconnect();
  } catch {
    // no-op
  }

  try {
    runtime.silentGain.disconnect();
  } catch {
    // no-op
  }

  safeStopStream(runtime.stream);

  try {
    void runtime.audioContext.close();
  } catch {
    // no-op
  }
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

  const onTextRef = useRef(onText);
  const stateRef = useRef<VoiceInputState>('idle');
  const runtimeRef = useRef<WavRecorderRuntime | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startedAtRef = useRef(0);
  const startInFlightRef = useRef(false);
  const stopAfterStartRef = useRef(false);
  const cancelledRef = useRef(false);
  const finalizeBusyRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);

  onTextRef.current = onText;

  const isSupported = useMemo(() => isVoiceSupported(), []);
  const effectiveMaxDurationMs = sessionMs ?? maxDurationMs;

  const setVoiceState = useCallback((nextState: VoiceInputState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearTimers = useCallback(() => {
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  const releaseActiveSession = useCallback(() => {
    if (sessionIdRef.current && activeVoiceSessionId === sessionIdRef.current) {
      activeVoiceSessionId = null;
    }
    sessionIdRef.current = null;
  }, []);

  const cleanupRuntime = useCallback(() => {
    clearTimers();
    disconnectRuntime(runtimeRef.current);
    runtimeRef.current = null;
    startInFlightRef.current = false;
    stopAfterStartRef.current = false;
    cancelledRef.current = false;
    finalizeBusyRef.current = false;
    pointerIdRef.current = null;
    setIsPressed(false);
    setIsCancelledBySwipe(false);
    releaseActiveSession();
  }, [clearTimers, releaseActiveSession]);

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
    cleanupRuntime();
    setError(null);
    setVoiceState('idle');
  }, [cleanupRuntime, setVoiceState]);

  const finalizeRecording = useCallback(async (reason: string) => {
    if (finalizeBusyRef.current) return;
    const runtime = runtimeRef.current;
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;

    finalizeBusyRef.current = true;
    clearTimers();
    setIsPressed(false);
    pointerIdRef.current = null;

    if (!runtime) {
      logVoiceDebugEvent('voice_error', { source, reason: 'missing-runtime', state: stateRef.current });
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    disconnectRuntime(runtime);
    runtimeRef.current = null;

    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_cancelled', { source, reason, durationMs, sessionId: runtime.sessionId });
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    if (durationMs < minDurationMs) {
      logVoiceDebugEvent('voice_blob_skipped', { source, reason: 'too-short', durationMs, sessionId: runtime.sessionId });
      cleanupRuntime();
      setError('no-speech');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
      return;
    }

    const { blob, inputSampleRate, outputSampleRate, sampleCount } = encodeWav(runtime.chunks, runtime.inputSampleRate);

    if (blob.size < MIN_UPLOAD_BYTES || sampleCount <= 0) {
      logVoiceDebugEvent('voice_blob_skipped', {
        source,
        reason: 'empty-wav',
        durationMs,
        blobSize: blob.size,
        sampleCount,
        sessionId: runtime.sessionId,
      });
      cleanupRuntime();
      setError('no-speech');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
      return;
    }

    logVoiceDebugEvent('voice_blob_ready', {
      source,
      recorderEngine: 'web-audio-wav',
      durationMs,
      blobSize: blob.size,
      blobType: blob.type,
      inputSampleRate,
      outputSampleRate,
      sampleCount,
      sessionId: runtime.sessionId,
    });

    setVoiceState('uploading');

    try {
      const filename = `voice-${Date.now()}.wav`;
      logVoiceDebugEvent('voice_transcribe_sent', {
        source,
        filename,
        language: getSttLanguage(lang),
        blobSize: blob.size,
        blobType: blob.type,
        sessionId: runtime.sessionId,
      });
      const response = await transcribeVoice(blob, filename, getSttLanguage(lang), TRANSCRIBE_TIMEOUT_MS);
      const text = normalizeVoiceText(response.text || '');

      logVoiceDebugEvent('voice_transcribe_success', {
        source,
        textLength: text.length,
        provider: response.provider,
        model: response.model,
        sessionId: runtime.sessionId,
      });

      if (!text) {
        cleanupRuntime();
        setError('no-speech');
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 0);
        return;
      }

      logVoiceDebugEvent('voice_text_received', { source, textLength: text.length, sessionId: runtime.sessionId });
      await onTextRef.current(text);
      cleanupRuntime();
      setError(null);
      setVoiceState('idle');
    } catch (nextError) {
      const errorCode = (nextError as Error & { code?: string }).code || getErrorCode(nextError);
      logVoiceDebugEvent('voice_transcribe_failed', { source, error: errorCode, sessionId: runtime.sessionId });
      cleanupRuntime();
      setError(errorCode === 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT' ? 'transcription-timeout' : 'transcription-error');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
    }
  }, [cleanupRuntime, clearTimers, lang, minDurationMs, setVoiceState, source]);

  const stop = useCallback(() => {
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    logVoiceDebugEvent('voice_stop_requested', { source, state: stateRef.current, durationMs, deferred: startInFlightRef.current, sessionId: sessionIdRef.current || undefined });
    setIsPressed(false);
    pointerIdRef.current = null;

    if (startInFlightRef.current && stateRef.current !== 'recording') {
      stopAfterStartRef.current = true;
      return;
    }

    if (stateRef.current !== 'recording') {
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    void finalizeRecording('manual-stop');
  }, [cleanupRuntime, finalizeRecording, setVoiceState, source]);

  const cancel = useCallback((reason = 'cancelled') => {
    logVoiceDebugEvent('voice_cancelled', { source, reason, state: stateRef.current, sessionId: sessionIdRef.current || undefined });
    cancelledRef.current = true;
    stopAfterStartRef.current = false;
    setIsPressed(false);
    setIsCancelledBySwipe(false);

    if (stateRef.current === 'recording') {
      void finalizeRecording(reason);
      return;
    }

    cleanupRuntime();
    setVoiceState('idle');
  }, [cleanupRuntime, finalizeRecording, setVoiceState, source]);

  const start = useCallback(async (): Promise<VoiceStartResult> => {
    if (!isSupported) {
      setPermissionState('unsupported');
      setError('unsupported');
      setVoiceState('error');
      return 'permission-ready';
    }

    if (stateRef.current === 'recording' || stateRef.current === 'uploading' || startInFlightRef.current) return 'busy';
    if (activeVoiceSessionId && activeVoiceSessionId !== sessionIdRef.current) return 'busy';

    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) {
      setPermissionState('unsupported');
      setError('unsupported');
      setVoiceState('error');
      return 'permission-ready';
    }

    const sessionId = createSessionId(source);
    sessionIdRef.current = sessionId;
    activeVoiceSessionId = sessionId;
    startInFlightRef.current = true;
    stopAfterStartRef.current = false;
    cancelledRef.current = false;
    finalizeBusyRef.current = false;
    setError(null);

    logVoiceDebugEvent('voice_start_requested', { source, recorderEngine: 'web-audio-wav', sessionId });

    startTimerRef.current = window.setTimeout(() => {
      if (!startInFlightRef.current) return;
      logVoiceDebugEvent('voice_error', { source, reason: 'start-timeout', sessionId });
      cancel('start-timeout');
      setError('microphone-timeout');
    }, START_TIMEOUT_MS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      if (cancelledRef.current || activeVoiceSessionId !== sessionId) {
        safeStopStream(stream);
        cleanupRuntime();
        setVoiceState('idle');
        return 'busy';
      }

      const audioContext = new AudioContextCtor();
      if (audioContext.state === 'suspended') await audioContext.resume();

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      const runtime: WavRecorderRuntime = {
        sessionId,
        stream,
        audioContext,
        sourceNode,
        processorNode,
        silentGain,
        inputSampleRate: audioContext.sampleRate,
        chunks: [],
      };

      processorNode.onaudioprocess = (event) => {
        if (stateRef.current !== 'recording' || cancelledRef.current) return;
        const channel = event.inputBuffer.getChannelData(0);
        runtime.chunks.push(new Float32Array(channel));
      };

      sourceNode.connect(processorNode);
      processorNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      runtimeRef.current = runtime;
      startedAtRef.current = Date.now();
      startInFlightRef.current = false;
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }

      setPermissionState('granted');
      setVoiceState('recording');
      logVoiceDebugEvent('voice_recorder_started', {
        source,
        recorderEngine: 'web-audio-wav',
        sessionId,
        inputSampleRate: audioContext.sampleRate,
        outputSampleRate: TARGET_SAMPLE_RATE,
        audioTracks: stream.getAudioTracks().length,
      });

      maxDurationTimerRef.current = window.setTimeout(() => {
        logVoiceDebugEvent('voice_auto_stop', { source, maxDurationMs: effectiveMaxDurationMs, sessionId });
        stop();
      }, Math.max(1200, effectiveMaxDurationMs));

      if (stopAfterStartRef.current) {
        stopAfterStartRef.current = false;
        window.setTimeout(() => stop(), 0);
      }

      return 'started';
    } catch (nextError) {
      startInFlightRef.current = false;
      clearTimers();
      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_error', { source, reason: 'start-failed', error: errorCode, sessionId });
      const permission = await queryMicrophonePermissionState();
      setPermissionState(permission ?? 'denied');
      setError(errorCode === 'NotAllowedError' ? 'microphone-denied' : 'microphone-error');
      cleanupRuntime();
      setVoiceState('error');
      return 'permission-ready';
    }
  }, [cancel, cleanupRuntime, clearTimers, effectiveMaxDurationMs, isSupported, setVoiceState, source, stop]);

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

      logVoiceDebugEvent('voice_permission_requested', { source, mode: 'prime' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      safeStopStream(stream);
      setPermissionState('granted');
      setError(null);
      logVoiceDebugEvent('voice_permission_granted', { source, mode: 'prime' });
      return true;
    } catch (nextError) {
      const errorCode = getErrorCode(nextError);
      logVoiceDebugEvent('voice_error', { source, reason: 'permission-denied', error: errorCode });
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
    logVoiceDebugEvent('voice_release', { source, state: stateRef.current, pointerId: event.pointerId });
    stop();
  }, [source, stop]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<Element>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    cancel('pointer-cancel');
  }, [cancel]);

  useEffect(() => {
    if (pointerIdRef.current === null && !isPressed) return;

    const release = (event?: PointerEvent | MouseEvent | TouchEvent) => {
      if (event && 'pointerId' in event && pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      logVoiceDebugEvent('voice_release', { source, state: stateRef.current, reason: 'window-release' });
      stop();
    };

    const pointerCancel = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      cancel('window-pointer-cancel');
    };

    const pageHideCancel = () => cancel('pagehide');
    const visibilityCancel = () => {
      if (document.visibilityState === 'hidden') cancel('visibility-hidden');
    };

    window.addEventListener('pointerup', release, true);
    window.addEventListener('mouseup', release, true);
    window.addEventListener('touchend', release, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('touchcancel', pageHideCancel, true);
    window.addEventListener('pagehide', pageHideCancel);
    document.addEventListener('visibilitychange', visibilityCancel);

    return () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('mouseup', release, true);
      window.removeEventListener('touchend', release, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('touchcancel', pageHideCancel, true);
      window.removeEventListener('pagehide', pageHideCancel);
      document.removeEventListener('visibilitychange', visibilityCancel);
    };
  }, [cancel, isPressed, source, stop]);

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
