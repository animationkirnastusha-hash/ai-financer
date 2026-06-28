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

type NativeRecorderFormat = {
  mimeType: string;
  extension: string;
  timesliceMs: number | null;
};

type NativeRecorderRuntime = {
  recorder: MediaRecorder;
  chunks: BlobPart[];
  format: NativeRecorderFormat;
  stopped: Promise<void>;
  resolveStopped: () => void;
  stopRequested: boolean;
};

type VoiceRecorderRuntime = {
  sessionId: string;
  stream: MediaStream;
  audioContext: AudioContext | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  processorNode: ScriptProcessorNode | null;
  silentGain: GainNode | null;
  inputSampleRate: number;
  wavChunks: Float32Array[];
  native: NativeRecorderRuntime | null;
};

type UploadCandidate = {
  blob: Blob;
  filename: string;
  engine: 'web-audio-wav' | 'media-recorder';
  sampleCount?: number;
  inputSampleRate?: number;
  outputSampleRate?: number;
  nativeChunks?: number;
};

const DEFAULT_MAX_DURATION_MS = 9000;
const DEFAULT_MIN_DURATION_MS = 160;
const DEFAULT_CANCEL_SWIPE_PX = 64;
const TRANSCRIBE_TIMEOUT_MS = 38000;
const START_TIMEOUT_MS = 12000;
const NATIVE_STOP_TIMEOUT_MS = 1400;
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

function isIosLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1);
}

function isVoiceSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      (getAudioContextCtor() || typeof MediaRecorder !== 'undefined'),
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

function getNativeRecorderFormats(): NativeRecorderFormat[] {
  const ios = isIosLike();
  const iosFormats: NativeRecorderFormat[] = [
    { mimeType: 'audio/mp4', extension: 'm4a', timesliceMs: null },
    { mimeType: 'audio/aac', extension: 'aac', timesliceMs: null },
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm', timesliceMs: 250 },
    { mimeType: 'audio/webm', extension: 'webm', timesliceMs: 250 },
    { mimeType: '', extension: 'webm', timesliceMs: null },
  ];
  const webFormats: NativeRecorderFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm', timesliceMs: 250 },
    { mimeType: 'audio/webm', extension: 'webm', timesliceMs: 250 },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg', timesliceMs: 250 },
    { mimeType: 'audio/mp4', extension: 'm4a', timesliceMs: null },
    { mimeType: '', extension: 'webm', timesliceMs: null },
  ];
  return ios ? iosFormats : webFormats;
}

function getNativeRecorderFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  return getNativeRecorderFormats().find((format) => {
    if (!format.mimeType) return true;
    try {
      return MediaRecorder.isTypeSupported(format.mimeType);
    } catch {
      return false;
    }
  }) ?? null;
}

function createNativeRecorder(stream: MediaStream, sessionId: string, source: string): NativeRecorderRuntime | null {
  const format = getNativeRecorderFormat();
  if (!format || typeof MediaRecorder === 'undefined') return null;

  try {
    const recorder = format.mimeType ? new MediaRecorder(stream, { mimeType: format.mimeType }) : new MediaRecorder(stream);
    const runtime: NativeRecorderRuntime = {
      recorder,
      chunks: [],
      format,
      stopped: Promise.resolve(),
      resolveStopped: () => undefined,
      stopRequested: false,
    };

    runtime.stopped = new Promise<void>((resolve) => {
      runtime.resolveStopped = resolve;
    });

    recorder.ondataavailable = (event) => {
      if (event.data?.size) runtime.chunks.push(event.data);
    };

    recorder.onerror = (event) => {
      logVoiceDebugEvent('voice_error', {
        source,
        reason: 'native-recorder-error',
        error: String((event as ErrorEvent).message || 'recorder-error'),
        sessionId,
      });
      runtime.resolveStopped();
    };

    recorder.onstop = () => {
      logVoiceDebugEvent('voice_native_recorder_stopped', {
        source,
        recorderEngine: 'media-recorder',
        mimeType: recorder.mimeType || format.mimeType || 'unknown',
        extension: format.extension,
        chunks: runtime.chunks.length,
        sessionId,
      });
      runtime.resolveStopped();
    };

    logVoiceDebugEvent('voice_native_recorder_ready', {
      source,
      recorderEngine: 'media-recorder',
      mimeType: recorder.mimeType || format.mimeType || 'unknown',
      extension: format.extension,
      timesliceMs: format.timesliceMs ?? 0,
      sessionId,
    });

    return runtime;
  } catch (error) {
    logVoiceDebugEvent('voice_error', {
      source,
      reason: 'native-recorder-create-failed',
      error: getErrorCode(error),
      mimeType: format.mimeType,
      extension: format.extension,
      sessionId,
    });
    return null;
  }
}

function startNativeRecorder(native: NativeRecorderRuntime | null) {
  if (!native) return;
  if (native.recorder.state !== 'inactive') return;
  if (native.format.timesliceMs && native.format.timesliceMs > 0) {
    native.recorder.start(native.format.timesliceMs);
  } else {
    native.recorder.start();
  }
}

async function stopNativeRecorder(native: NativeRecorderRuntime | null) {
  if (!native || native.stopRequested) return;
  native.stopRequested = true;

  try {
    if (native.recorder.state !== 'inactive') {
      native.recorder.requestData?.();
      native.recorder.stop();
    } else {
      native.resolveStopped();
    }
  } catch {
    native.resolveStopped();
  }

  await Promise.race([
    native.stopped,
    new Promise<void>((resolve) => window.setTimeout(resolve, NATIVE_STOP_TIMEOUT_MS)),
  ]);
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

function disconnectRuntime(runtime: VoiceRecorderRuntime | null) {
  if (!runtime) return;

  try {
    if (runtime.processorNode) runtime.processorNode.onaudioprocess = null;
    runtime.processorNode?.disconnect();
  } catch {
    // no-op
  }

  try {
    runtime.sourceNode?.disconnect();
  } catch {
    // no-op
  }

  try {
    runtime.silentGain?.disconnect();
  } catch {
    // no-op
  }

  try {
    void runtime.audioContext?.close();
  } catch {
    // no-op
  }

  safeStopStream(runtime.stream);
}

function createNativeUploadCandidate(native: NativeRecorderRuntime | null): UploadCandidate | null {
  if (!native?.chunks.length) return null;

  const actualType = native.recorder.mimeType || native.format.mimeType || 'application/octet-stream';
  const blob = new Blob(native.chunks, { type: actualType });
  if (blob.size < MIN_UPLOAD_BYTES) return null;

  return {
    blob,
    filename: `voice-${Date.now()}.${native.format.extension}`,
    engine: 'media-recorder',
    nativeChunks: native.chunks.length,
  };
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
  const runtimeRef = useRef<VoiceRecorderRuntime | null>(null);
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

    await stopNativeRecorder(runtime.native);

    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_cancelled', { source, reason, durationMs, sessionId: runtime.sessionId });
      cleanupRuntime();
      setVoiceState('idle');
      return;
    }

    let wavCandidate: UploadCandidate | null = null;
    if (runtime.wavChunks.length) {
      const wav = encodeWav(runtime.wavChunks, runtime.inputSampleRate);
      if (wav.blob.size >= MIN_UPLOAD_BYTES && wav.sampleCount > 0) {
        wavCandidate = {
          blob: wav.blob,
          filename: `voice-${Date.now()}.wav`,
          engine: 'web-audio-wav',
          sampleCount: wav.sampleCount,
          inputSampleRate: wav.inputSampleRate,
          outputSampleRate: wav.outputSampleRate,
        };
      }
    }

    const nativeCandidate = createNativeUploadCandidate(runtime.native);
    const candidate = wavCandidate ?? nativeCandidate;

    disconnectRuntime(runtime);
    runtimeRef.current = null;

    if (durationMs < minDurationMs) {
      logVoiceDebugEvent('voice_blob_skipped', { source, reason: 'too-short', durationMs, sessionId: runtime.sessionId });
      cleanupRuntime();
      setError('no-speech');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 0);
      return;
    }

    if (!candidate) {
      logVoiceDebugEvent('voice_blob_skipped', {
        source,
        reason: 'empty-recording',
        durationMs,
        wavChunks: runtime.wavChunks.length,
        nativeChunks: runtime.native?.chunks.length ?? 0,
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
      recorderEngine: candidate.engine,
      durationMs,
      blobSize: candidate.blob.size,
      blobType: candidate.blob.type,
      inputSampleRate: candidate.inputSampleRate,
      outputSampleRate: candidate.outputSampleRate,
      sampleCount: candidate.sampleCount,
      nativeChunks: candidate.nativeChunks,
      sessionId: runtime.sessionId,
    });

    setVoiceState('uploading');

    try {
      logVoiceDebugEvent('voice_transcribe_sent', {
        source,
        filename: candidate.filename,
        language: getSttLanguage(lang),
        blobSize: candidate.blob.size,
        blobType: candidate.blob.type,
        sessionId: runtime.sessionId,
      });
      const response = await transcribeVoice(candidate.blob, candidate.filename, getSttLanguage(lang), TRANSCRIBE_TIMEOUT_MS);
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

    const sessionId = createSessionId(source);
    sessionIdRef.current = sessionId;
    activeVoiceSessionId = sessionId;
    startInFlightRef.current = true;
    stopAfterStartRef.current = false;
    cancelledRef.current = false;
    finalizeBusyRef.current = false;
    setError(null);

    logVoiceDebugEvent('voice_start_requested', { source, recorderEngine: 'hybrid-wav-native', sessionId });

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

      const AudioContextCtor = getAudioContextCtor();
      let audioContext: AudioContext | null = null;
      let sourceNode: MediaStreamAudioSourceNode | null = null;
      let processorNode: ScriptProcessorNode | null = null;
      let silentGain: GainNode | null = null;
      let inputSampleRate = TARGET_SAMPLE_RATE;
      const wavChunks: Float32Array[] = [];

      if (AudioContextCtor) {
        try {
          audioContext = new AudioContextCtor();
          if (audioContext.state === 'suspended') await audioContext.resume();

          sourceNode = audioContext.createMediaStreamSource(stream);
          processorNode = audioContext.createScriptProcessor(4096, 1, 1);
          silentGain = audioContext.createGain();
          silentGain.gain.value = 0;
          inputSampleRate = audioContext.sampleRate;

          processorNode.onaudioprocess = (event) => {
            if (stateRef.current !== 'recording' || cancelledRef.current) return;
            const channel = event.inputBuffer.getChannelData(0);
            wavChunks.push(new Float32Array(channel));
          };

          sourceNode.connect(processorNode);
          processorNode.connect(silentGain);
          silentGain.connect(audioContext.destination);
        } catch (error) {
          logVoiceDebugEvent('voice_error', {
            source,
            reason: 'web-audio-unavailable',
            error: getErrorCode(error),
            sessionId,
          });
          try {
            processorNode?.disconnect();
            sourceNode?.disconnect();
            silentGain?.disconnect();
            void audioContext?.close();
          } catch {
            // no-op
          }
          audioContext = null;
          sourceNode = null;
          processorNode = null;
          silentGain = null;
        }
      }

      const native = createNativeRecorder(stream, sessionId, source);
      const runtime: VoiceRecorderRuntime = {
        sessionId,
        stream,
        audioContext,
        sourceNode,
        processorNode,
        silentGain,
        inputSampleRate,
        wavChunks,
        native,
      };

      runtimeRef.current = runtime;
      startedAtRef.current = Date.now();
      setPermissionState('granted');
      setVoiceState('recording');
      startInFlightRef.current = false;
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }

      startNativeRecorder(native);

      logVoiceDebugEvent('voice_recorder_started', {
        source,
        recorderEngine: audioContext ? 'hybrid-web-audio-native' : native ? 'media-recorder' : 'stream-only',
        sessionId,
        inputSampleRate,
        outputSampleRate: TARGET_SAMPLE_RATE,
        audioTracks: stream.getAudioTracks().length,
        hasRecorder: Boolean(native),
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
