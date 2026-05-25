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

const DEFAULT_SESSION_MS = 3800;
const MIN_SESSION_MS = 1800;
const MAX_SESSION_MS = 6500;
const MIN_AUDIO_BYTES = 1200;
const TRANSCRIBE_CLIENT_TIMEOUT_MS = 45_000;
const MICROPHONE_GAIN = 7.5;
const VAD_CHECK_INTERVAL_MS = 60;
const VAD_MIN_RECORDING_MS = 620;
const VAD_GRACE_AFTER_VOICE_MS = 1050;
const VAD_GRACE_AFTER_STRONG_VOICE_MS = 900;
const VAD_NO_VOICE_AUTO_STOP_MS = 2100;
const VAD_VOICE_RMS = 0.015;
const VAD_CONTINUE_RMS = 0.010;
const VAD_STRONG_VOICE_RMS = 0.035;

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

function hasActiveTracks(stream: MediaStream | null) {
  return Boolean(stream?.getTracks().some((track) => track.readyState === 'live'));
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
  const finalHadVoiceRef = useRef(false);
  const finalPeakRmsRef = useRef(0);
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

  const resetVadRuntime = useCallback(() => {
    voiceDetectedRef.current = false;
    lastVoiceAtRef.current = 0;
    vadStartedAtRef.current = 0;
    vadPeakRmsRef.current = 0;
  }, []);

  const stopVoiceActivityWatcher = useCallback(() => {
    if (vadTimerRef.current !== null) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    finalHadVoiceRef.current = voiceDetectedRef.current;
    finalPeakRmsRef.current = vadPeakRmsRef.current;
    resetVadRuntime();
  }, [resetVadRuntime]);

  const stopAllStreams = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }

    analyserRef.current = null;
    vadBufferRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const createAmplifiedStream = useCallback((rawStream: MediaStream, format: RecorderFormat): MediaStream => {
    if (typeof window === 'undefined') return rawStream;

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return rawStream;

      const context = audioContextRef.current ?? new AudioContextCtor();
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }

      const source = context.createMediaStreamSource(rawStream);
      const gain = context.createGain();
      const analyser = context.createAnalyser();
      const destination = context.createMediaStreamDestination();

      gain.gain.value = MICROPHONE_GAIN;
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.28;

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

  const ensureStream = useCallback(async (format: RecorderFormat) => {
    if (hasActiveTracks(rawStreamRef.current) && hasActiveTracks(streamRef.current) && analyserRef.current && vadBufferRef.current) {
      logVoiceDebugEvent('microphone_stream_reused', {
        mimeType: format.mimeType,
        extension: format.extension,
        audioTracks: rawStreamRef.current?.getAudioTracks().length ?? 0,
      });
      return streamRef.current as MediaStream;
    }

    stopAllStreams();

    logVoiceDebugEvent('permission_requested', { mimeType: format.mimeType, extension: format.extension });
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
    const stream = createAmplifiedStream(rawStream, format);
    streamRef.current = stream;

    logVoiceDebugEvent('permission_granted', {
      mimeType: format.mimeType,
      extension: format.extension,
      audioTracks: rawStream.getAudioTracks().length,
    });

    rawStream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          logVoiceDebugEvent('microphone_track_ended', { mimeType: format.mimeType, extension: format.extension });
        }
        rawStreamRef.current = null;
        streamRef.current = null;
        analyserRef.current = null;
        vadBufferRef.current = null;
      };
    });

    return stream;
  }, [createAmplifiedStream, stopAllStreams]);

  const hardCleanup = useCallback(() => {
    clearFinalizeTimer();
    stopVoiceActivityWatcher();
    stopAllStreams();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    activeFormatRef.current = null;
    recordingStartedAtRef.current = 0;
    startInProgressRef.current = false;
    cancelledRef.current = false;
    finalHadVoiceRef.current = false;
    finalPeakRmsRef.current = 0;
  }, [clearFinalizeTimer, stopAllStreams, stopVoiceActivityWatcher]);

  const uploadFinalBlob = useCallback(async (blob: Blob, format: RecorderFormat, hadVoice: boolean, peakRms: number) => {
    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_session_cancelled_before_upload', {
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });
      setState('idle');
      return;
    }

    if (!hadVoice) {
      logVoiceDebugEvent('audio_blob_skipped_no_voice', {
        blobSize: blob.size,
        peakRms: Number(peakRms.toFixed(4)),
        mimeType: format.mimeType,
        extension: format.extension,
      });
      setState('idle');
      return;
    }

    if (blob.size < MIN_AUDIO_BYTES) {
      logVoiceDebugEvent('audio_blob_too_small', {
        blobSize: blob.size,
        peakRms: Number(peakRms.toFixed(4)),
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
      peakRms: Number(peakRms.toFixed(4)),
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
      mediaRecorderRef.current = null;
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
    recordingStartedAtRef.current = Date.now();
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
      const elapsedMs = now - recordingStartedAtRef.current;
      const isVoiceNow = rms >= VAD_VOICE_RMS || (voiceDetectedRef.current && rms >= VAD_CONTINUE_RMS);

      if (isVoiceNow) {
        if (!voiceDetectedRef.current) {
          logVoiceDebugEvent('speech_started', {
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

      if (!voiceDetectedRef.current) {
        if (elapsedMs >= VAD_NO_VOICE_AUTO_STOP_MS) {
          logVoiceDebugEvent('vad_stop_no_speech', {
            elapsedMs,
            peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
            mimeType: format.mimeType,
            extension: format.extension,
          });
          finalizeRecording(false);
        }
        return;
      }

      if (elapsedMs < VAD_MIN_RECORDING_MS) return;

      const silenceMs = now - lastVoiceAtRef.current;
      const hadStrongVoice = vadPeakRmsRef.current >= VAD_STRONG_VOICE_RMS;
      const requiredSilenceMs = hadStrongVoice ? VAD_GRACE_AFTER_STRONG_VOICE_MS : VAD_GRACE_AFTER_VOICE_MS;

      if (silenceMs >= requiredSilenceMs) {
        logVoiceDebugEvent('vad_stop_triggered', {
          elapsedMs,
          silenceMs,
          graceMs: requiredSilenceMs,
          peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
          mimeType: format.mimeType,
          extension: format.extension,
        });
        logVoiceDebugEvent('speech_ended', { elapsedMs, silenceMs });
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
      finalHadVoiceRef.current = false;
      finalPeakRmsRef.current = 0;

      const stream = await ensureStream(recorderFormat);
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
          persistentStream: hasActiveTracks(rawStreamRef.current),
        });
        setState('recording');

        startVoiceActivityWatcher(recorderFormat);

        finalizeTimerRef.current = window.setTimeout(() => {
          logVoiceDebugEvent('voice_max_session_reached', {
            elapsedMs: Date.now() - recordingStartedAtRef.current,
            peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
            hadVoice: voiceDetectedRef.current,
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
        const hadVoice = finalHadVoiceRef.current || voiceDetectedRef.current;
        const peakRms = Math.max(finalPeakRmsRef.current, vadPeakRmsRef.current);

        logVoiceDebugEvent('recorder_stopped', {
          mimeType: recorder.mimeType || format.mimeType,
          extension: format.extension,
          elapsedMs,
          blobSize: blob.size,
          hadVoice,
          peakRms: Number(peakRms.toFixed(4)),
          cancelled: cancelledRef.current,
        });

        clearFinalizeTimer();
        stopVoiceActivityWatcher();
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

        logVoiceDebugEvent('audio_blob_ready', { mimeType: format.mimeType, extension: format.extension, blobSize: blob.size, hadVoice });
        void uploadFinalBlob(blob, format, hadVoice, peakRms).finally(() => {
          cancelledRef.current = false;
        });
      };

      mediaRecorderRef.current = recorder;
      logVoiceDebugEvent('recorder_start_call', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension, sessionMs: clampSessionMs(chunkMs) });
      recorder.start(250);
    } catch (err) {
      startInProgressRef.current = false;
      console.error(err);
      logVoiceDebugEvent('recorder_start_failed', { error: err instanceof Error ? err.name || err.message : 'unknown' });
      setError('microphone-denied');
      setState('error');
      hardCleanup();
    }
  }, [chunkMs, ensureStream, finalizeRecording, hardCleanup, isSupported, recorderFormat, startVoiceActivityWatcher, state, uploadFinalBlob, clearFinalizeTimer, stopVoiceActivityWatcher]);

  const stopRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_stop_and_send', { state });
    finalizeRecording(false);
  }, [finalizeRecording, state]);

  const cancelRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_cancel', { state });
    finalizeRecording(true);
  }, [finalizeRecording, state]);

  const reset = useCallback(() => {
    hardCleanup();
    setError(null);
    setState('idle');
    startInProgressRef.current = false;
  }, [hardCleanup]);

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
