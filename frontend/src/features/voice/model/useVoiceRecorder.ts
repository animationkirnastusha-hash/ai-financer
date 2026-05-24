import { useCallback, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from '@/features/voice/api/voice.api';

type VoiceRecorderState = 'idle' | 'recording' | 'uploading' | 'error';

type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  chunkMs?: number;
};

type RecorderFormat = {
  mimeType: string;
  extension: string;
};

const DEFAULT_SESSION_MS = 8500;
const MIN_SESSION_MS = 3600;
const MAX_SESSION_MS = 12000;
const MIN_AUDIO_BYTES = 900;
const TRANSCRIBE_CLIENT_TIMEOUT_MS = 45_000;
const MICROPHONE_GAIN = 3.0;
const VAD_CHECK_INTERVAL_MS = 80;
const VAD_MIN_RECORDING_MS = 1500;
const VAD_MIN_AFTER_VOICE_MS = 780;
const VAD_VOICE_RMS = 0.022;
const VAD_STRONG_VOICE_RMS = 0.045;

function getBestRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') {
    logVoiceDebugEvent('mediarecorder_unavailable');
    return null;
  }

  const formats: RecorderFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/aac', extension: 'aac' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
    { mimeType: 'audio/ogg', extension: 'ogg' },
  ];

  return formats.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
}

function toSttLanguage(lang: string) {
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

function clampSessionMs(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SESSION_MS;
  return Math.max(MIN_SESSION_MS, Math.min(MAX_SESSION_MS, Math.round(value)));
}

export function useVoiceRecorder({ onText, lang = 'ru-RU', chunkMs = DEFAULT_SESSION_MS }: UseVoiceRecorderParams) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<number | null>(null);
  const vadBufferRef = useRef<Uint8Array | null>(null);
  const voiceDetectedRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const vadStartedAtRef = useRef(0);
  const vadPeakRmsRef = useRef(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const activeFormatRef = useRef<RecorderFormat | null>(null);
  const onTextRef = useRef(onText);
  const recordingStartedAtRef = useRef(0);
  const startInProgressRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

  onTextRef.current = onText;

  const recorderFormat = useMemo(() => getBestRecorderFormat(), []);
  const isSupported = Boolean(
    typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      recorderFormat,
  );

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const stopVoiceActivityWatcher = useCallback(() => {
    if (vadTimerRef.current !== null) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }

    analyserRef.current = null;
    vadBufferRef.current = null;
    voiceDetectedRef.current = false;
    lastVoiceAtRef.current = 0;
    vadStartedAtRef.current = 0;
    vadPeakRmsRef.current = 0;
  }, []);

  const cleanupStream = useCallback(() => {
    stopVoiceActivityWatcher();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, [stopVoiceActivityWatcher]);

  const createAmplifiedStream = useCallback((rawStream: MediaStream, format: RecorderFormat): MediaStream => {
    if (typeof window === 'undefined') return rawStream;

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return rawStream;

      const context = new AudioContextCtor();
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }

      const source = context.createMediaStreamSource(rawStream);
      const gain = context.createGain();
      const analyser = context.createAnalyser();
      const destination = context.createMediaStreamDestination();

      gain.gain.value = MICROPHONE_GAIN;
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;

      source.connect(gain);
      gain.connect(destination);
      gain.connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      vadBufferRef.current = new Uint8Array(analyser.fftSize);

      logVoiceDebugEvent('microphone_gain_applied', {
        gain: MICROPHONE_GAIN,
        mimeType: format.mimeType,
        extension: format.extension,
        audioContextState: context.state,
      });

      return destination.stream;
    } catch (error) {
      logVoiceDebugEvent('microphone_gain_unavailable', {
        error: error instanceof Error ? error.name || error.message : 'unknown',
        mimeType: format.mimeType,
        extension: format.extension,
      });
      return rawStream;
    }
  }, []);

  const hardCleanup = useCallback(() => {
    clearFinalizeTimer();
    stopVoiceActivityWatcher();
    cleanupStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    activeFormatRef.current = null;
    recordingStartedAtRef.current = 0;
    startInProgressRef.current = false;
    cancelledRef.current = false;
  }, [clearFinalizeTimer, cleanupStream, stopVoiceActivityWatcher]);

  const uploadFinalBlob = useCallback(async (blob: Blob, format: RecorderFormat) => {
    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_session_cancelled_before_upload', {
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });
      setState('idle');
      return;
    }

    if (blob.size < MIN_AUDIO_BYTES) {
      logVoiceDebugEvent('audio_blob_too_small', {
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });
      setError('no-speech');
      setState('idle');
      return;
    }

    const uploadStartedAt = Date.now();
    setState('uploading');
    logVoiceDebugEvent('transcribe_request_sent', {
      blobSize: blob.size,
      mimeType: format.mimeType,
      extension: format.extension,
    });

    try {
      const result = await transcribeVoice(blob, `voice.${format.extension}`, toSttLanguage(lang), TRANSCRIBE_CLIENT_TIMEOUT_MS);
      const text = result.text?.trim();
      logVoiceDebugEvent('transcribe_request_success', {
        status: 200,
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
        elapsedMs: Date.now() - uploadStartedAt,
        textLength: text?.length ?? 0,
        hasText: Boolean(text),
      });

      if (text) {
        await onTextRef.current(text);
      } else {
        setError('no-speech');
      }

      setState('idle');
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status?: unknown }).status) : 0;
      logVoiceDebugEvent('transcribe_request_failed', {
        code,
        status,
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
        elapsedMs: Date.now() - uploadStartedAt,
      });

      if (code === 'VOICE_TRANSCRIPTION_NOT_CONFIGURED' || status === 503) {
        setError('transcription-not-configured');
        setState('error');
        return;
      }

      setError(code === 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT' || status === 504 ? 'transcription-timeout' : 'transcription-error');
      setState('idle');
    }
  }, [lang]);

  const finalizeRecording = useCallback((cancelled = false) => {
    clearFinalizeTimer();
    cancelledRef.current = cancelled;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      hardCleanup();
      setState('idle');
      return;
    }

    try {
      recorder.stop();
    } catch {
      hardCleanup();
      setError('recording-error');
      setState('idle');
    }
  }, [clearFinalizeTimer, hardCleanup]);


  const startVoiceActivityWatcher = useCallback((format: RecorderFormat) => {
    stopVoiceActivityWatcher();

    const analyser = analyserRef.current;
    const buffer = vadBufferRef.current as Uint8Array<ArrayBuffer> | null;
    if (!analyser || !buffer) {
      logVoiceDebugEvent('voice_vad_unavailable', {
        mimeType: format.mimeType,
        extension: format.extension,
      });
      return;
    }

    vadStartedAtRef.current = Date.now();
    lastVoiceAtRef.current = 0;
    voiceDetectedRef.current = false;
    vadPeakRmsRef.current = 0;

    vadTimerRef.current = window.setInterval(() => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') return;

      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let index = 0; index < buffer.length; index += 1) {
        const centered = (buffer[index] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / Math.max(1, buffer.length));
      vadPeakRmsRef.current = Math.max(vadPeakRmsRef.current, rms);

      const now = Date.now();
      const elapsedMs = recordingStartedAtRef.current ? now - recordingStartedAtRef.current : now - vadStartedAtRef.current;
      const isVoiceNow = rms >= VAD_VOICE_RMS || (voiceDetectedRef.current && rms >= VAD_VOICE_RMS * 0.72);

      if (isVoiceNow) {
        if (!voiceDetectedRef.current) {
          logVoiceDebugEvent('voice_vad_speech_detected', {
            elapsedMs,
            rms: Number(rms.toFixed(4)),
            peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
            mimeType: format.mimeType,
            extension: format.extension,
          });
        }

        voiceDetectedRef.current = true;
        lastVoiceAtRef.current = now;
        return;
      }

      if (!voiceDetectedRef.current) return;
      if (elapsedMs < VAD_MIN_RECORDING_MS) return;

      const silenceMs = now - lastVoiceAtRef.current;
      const hadStrongVoice = vadPeakRmsRef.current >= VAD_STRONG_VOICE_RMS;
      const requiredSilenceMs = hadStrongVoice ? VAD_MIN_AFTER_VOICE_MS : VAD_MIN_AFTER_VOICE_MS + 220;

      if (silenceMs >= requiredSilenceMs) {
        logVoiceDebugEvent('voice_vad_auto_stop', {
          elapsedMs,
          silenceMs,
          peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
          mimeType: format.mimeType,
          extension: format.extension,
        });
        finalizeRecording(false);
      }
    }, VAD_CHECK_INTERVAL_MS);
  }, [finalizeRecording, stopVoiceActivityWatcher]);

  const startRecording = useCallback(async () => {
    if (startInProgressRef.current) {
      logVoiceDebugEvent('voice_start_ignored_in_progress', { state });
      return;
    }

    if (state === 'recording' || state === 'uploading') {
      logVoiceDebugEvent('voice_start_ignored_busy', { state });
      return;
    }

    if (!isSupported || !recorderFormat) {
      logVoiceDebugEvent('recorder_unsupported', { isSupported, mimeType: recorderFormat?.mimeType, extension: recorderFormat?.extension });
      setError('unsupported');
      setState('error');
      return;
    }

    startInProgressRef.current = true;
    cancelledRef.current = false;

    try {
      setError(null);
      chunksRef.current = [];
      activeFormatRef.current = recorderFormat;

      logVoiceDebugEvent('permission_requested', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
      });
      rawStreamRef.current = rawStream;
      const stream = createAmplifiedStream(rawStream, recorderFormat);
      streamRef.current = stream;
      logVoiceDebugEvent('permission_granted', {
        mimeType: recorderFormat.mimeType,
        extension: recorderFormat.extension,
        audioTracks: rawStream.getAudioTracks().length,
      });

      rawStream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            logVoiceDebugEvent('microphone_track_ended', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });
          }
        };
      });

      const recorder = new MediaRecorder(stream, { mimeType: recorderFormat.mimeType });

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) {
          logVoiceDebugEvent('audio_blob_empty', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension, blobSize: event.data?.size ?? 0 });
          return;
        }
        chunksRef.current.push(event.data);
      };

      recorder.onstart = () => {
        startInProgressRef.current = false;
        recordingStartedAtRef.current = Date.now();
        logVoiceDebugEvent('recorder_started', {
          mimeType: recorder.mimeType || recorderFormat.mimeType,
          extension: recorderFormat.extension,
          recordingState: recorder.state,
          sessionMs: clampSessionMs(chunkMs),
        });
        setState('recording');

        startVoiceActivityWatcher(recorderFormat);

        finalizeTimerRef.current = window.setTimeout(() => {
          logVoiceDebugEvent('voice_max_session_reached', {
            elapsedMs: Date.now() - recordingStartedAtRef.current,
            peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
            sessionMs: clampSessionMs(chunkMs),
            mimeType: recorderFormat.mimeType,
            extension: recorderFormat.extension,
          });
          finalizeRecording(false);
        }, clampSessionMs(chunkMs));
      };

      recorder.onerror = () => {
        logVoiceDebugEvent('recorder_error', { mimeType: recorder.mimeType || recorderFormat.mimeType, extension: recorderFormat.extension, recordingState: recorder.state });
        setError('recording-error');
        finalizeRecording(true);
      };

      recorder.onstop = () => {
        const format = activeFormatRef.current ?? recorderFormat;
        const elapsedMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
        const blob = new Blob(chunksRef.current, { type: format.mimeType });

        logVoiceDebugEvent('recorder_stopped', {
          mimeType: recorder.mimeType || format.mimeType,
          extension: format.extension,
          elapsedMs,
          blobSize: blob.size,
          cancelled: cancelledRef.current,
        });

        stopVoiceActivityWatcher();
        cleanupStream();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        activeFormatRef.current = null;
        recordingStartedAtRef.current = 0;
        startInProgressRef.current = false;

        if (cancelledRef.current) {
          hardCleanup();
          setState('idle');
          return;
        }

        logVoiceDebugEvent('audio_blob_ready', { mimeType: format.mimeType, extension: format.extension, blobSize: blob.size });
        void uploadFinalBlob(blob, format).finally(() => {
          cancelledRef.current = false;
        });
      };

      mediaRecorderRef.current = recorder;
      logVoiceDebugEvent('recorder_start_call', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension, sessionMs: clampSessionMs(chunkMs) });
      recorder.start();
    } catch (err) {
      startInProgressRef.current = false;
      console.error(err);
      logVoiceDebugEvent('recorder_start_failed', { error: err instanceof Error ? err.name || err.message : 'unknown' });
      setError('microphone-denied');
      setState('error');
      cleanupStream();
    }
  }, [chunkMs, cleanupStream, createAmplifiedStream, finalizeRecording, hardCleanup, isSupported, recorderFormat, startVoiceActivityWatcher, state, stopVoiceActivityWatcher, uploadFinalBlob]);

  const stopRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_stop_and_send', { state });
    finalizeRecording(false);
  }, [finalizeRecording, state]);

  const cancelRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_cancel', { state });
    finalizeRecording(true);
  }, [finalizeRecording, state]);

  const reset = useCallback(() => {
    finalizeRecording(true);
    setError(null);
    setState('idle');
    startInProgressRef.current = false;
  }, [finalizeRecording]);

  return {
    state,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
