import { useCallback, useMemo, useRef, useState } from 'react';
import { logVoiceDebugEvent, transcribeVoice } from '@/features/voice/api/voice.api';
import { getVoiceRecorderPlatformConfig, type RecorderFormat } from './voiceRecorderPlatform';
import type { UseVoiceRecorderParams, VoiceRecorderState } from './voiceRecorder.types';
import {
  VOICE_RECORDER_DEFAULT_SESSION_MS,
  VOICE_RECORDER_MICROPHONE_GAIN,
  VOICE_RECORDER_TRANSCRIBE_CLIENT_TIMEOUT_MS,
  VOICE_RECORDER_VAD_CHECK_INTERVAL_MS,
} from './voiceRecorder.constants';
import {
  clampVoiceRecorderSessionMs,
  getBestRecorderFormat,
  hasActiveTracks,
  toSttLanguage,
} from './voiceRecorder.helpers';
import { getVoiceUploadSkipReason } from './voiceRecorderUploadGuards';

export function useVoiceRecorder({ onText, lang = 'ru-RU', chunkMs = VOICE_RECORDER_DEFAULT_SESSION_MS }: UseVoiceRecorderParams) {
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
  const startGuardTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const lifecycleBusyRef = useRef(false);
  const manualStopOnlyRef = useRef(false);
  const stopAfterStartRef = useRef(false);
  const cancelAfterStartRef = useRef(false);

  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

  onTextRef.current = onText;

  const platformConfig = useMemo(() => getVoiceRecorderPlatformConfig(), []);
  const recorderFormat = useMemo(() => getBestRecorderFormat(platformConfig.formats, platformConfig.platform), [platformConfig]);
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

  const clearStartGuardTimer = useCallback(() => {
    if (startGuardTimerRef.current !== null) {
      window.clearTimeout(startGuardTimerRef.current);
      startGuardTimerRef.current = null;
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

      gain.gain.value = VOICE_RECORDER_MICROPHONE_GAIN;
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.28;

      source.connect(gain);
      gain.connect(destination);
      gain.connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      vadBufferRef.current = new Uint8Array(analyser.fftSize);

      logVoiceDebugEvent('microphone_gain_applied', {
        gain: VOICE_RECORDER_MICROPHONE_GAIN,
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
    // Manual press-to-talk must not keep a hot microphone stream between commands.
    // Requesting a fresh stream after the permission was granted does not duplicate
    // the browser permission prompt, but it does turn off the device mic indicator
    // immediately after each recording.
    stopAllStreams();

    logVoiceDebugEvent('permission_requested', { platform: platformConfig.platform, mimeType: format.mimeType, extension: format.extension });
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: platformConfig.audioConstraints,
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
  }, [createAmplifiedStream, platformConfig, stopAllStreams]);

  const hardCleanup = useCallback(() => {
    clearFinalizeTimer();
    clearStartGuardTimer();
    stopVoiceActivityWatcher();
    stopAllStreams();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    activeFormatRef.current = null;
    recordingStartedAtRef.current = 0;
    startInProgressRef.current = false;
    lifecycleBusyRef.current = false;
    manualStopOnlyRef.current = false;
    cancelledRef.current = false;
    stopAfterStartRef.current = false;
    cancelAfterStartRef.current = false;
    finalHadVoiceRef.current = false;
    finalPeakRmsRef.current = 0;
  }, [clearFinalizeTimer, clearStartGuardTimer, stopAllStreams, stopVoiceActivityWatcher]);

  const uploadFinalBlob = useCallback(async (blob: Blob, format: RecorderFormat, hadVoice: boolean, peakRms: number) => {
    if (cancelledRef.current) {
      logVoiceDebugEvent('voice_session_cancelled_before_upload', {
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });
      lifecycleBusyRef.current = false;
      setState('idle');
      return;
    }

    const elapsedMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
    const uploadSkipReason = getVoiceUploadSkipReason({
      elapsedMs,
      hadVoice,
      peakRms,
      blobSize: blob.size,
    });

    if (uploadSkipReason) {
      const isTooSmall = uploadSkipReason === 'too-small';
      logVoiceDebugEvent(
        uploadSkipReason === 'too-short'
          ? 'audio_blob_skipped_too_short'
          : isTooSmall
            ? 'audio_blob_too_small'
            : 'audio_blob_skipped_no_voice',
        {
          reason: uploadSkipReason,
          elapsedMs,
          blobSize: blob.size,
          peakRms: Number(peakRms.toFixed(4)),
          mimeType: format.mimeType,
          extension: format.extension,
        },
      );
      if (isTooSmall) setError('no-speech');
      recordingStartedAtRef.current = 0;
      lifecycleBusyRef.current = false;
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
      const result = await transcribeVoice(blob, `voice.${format.extension}`, toSttLanguage(lang), VOICE_RECORDER_TRANSCRIBE_CLIENT_TIMEOUT_MS);
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

      recordingStartedAtRef.current = 0;
      lifecycleBusyRef.current = false;
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
        lifecycleBusyRef.current = false;
        setState('error');
        return;
      }

      setError(status === 429 ? 'rate-limited' : code === 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT' || status === 504 ? 'transcription-timeout' : 'transcription-error');
      recordingStartedAtRef.current = 0;
      lifecycleBusyRef.current = false;
      setState('idle');
    }
  }, [lang]);

  const finalizeRecording = useCallback((cancelled = false) => {
    clearFinalizeTimer();
    cancelledRef.current = cancelled;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      mediaRecorderRef.current = null;
      lifecycleBusyRef.current = false;
      setState('idle');
      return;
    }

    try {
      recorder.requestData?.();
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

    const vadProfile = platformConfig.vad;

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
      const isVoiceNow = rms >= vadProfile.voiceRms || (voiceDetectedRef.current && rms >= vadProfile.continueRms);

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
        return;
      }

      if (elapsedMs < vadProfile.minRecordingMs) return;

      const silenceMs = now - lastVoiceAtRef.current;
      const hadStrongVoice = vadPeakRmsRef.current >= vadProfile.strongVoiceRms;
      const requiredSilenceMs = hadStrongVoice ? vadProfile.graceAfterStrongVoiceMs : vadProfile.graceAfterVoiceMs;

      if (silenceMs >= requiredSilenceMs) {
        logVoiceDebugEvent('vad_silence_detected_manual_hold', {
          elapsedMs,
          silenceMs,
          graceMs: requiredSilenceMs,
          peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
          mimeType: format.mimeType,
          extension: format.extension,
          manualStopOnly: manualStopOnlyRef.current,
        });
        // In manual press-to-talk mode VAD is diagnostic only. It may mark
        // that speech ended, but it must never send audio to STT by itself.
        // Sending is allowed only from explicit user intent: release button,
        // tap Fina in locked mode, or explicit cancel.
      }
    }, VOICE_RECORDER_VAD_CHECK_INTERVAL_MS);
  }, [finalizeRecording, platformConfig, stopVoiceActivityWatcher]);

  const startRecording = useCallback(async () => {
    if (startInProgressRef.current || lifecycleBusyRef.current) {
      logVoiceDebugEvent('voice_start_ignored_in_progress', { state });
      return false;
    }

    if (state === 'recording' || state === 'uploading') {
      logVoiceDebugEvent('voice_start_ignored_busy', { state });
      return false;
    }

    if (!isSupported || !recorderFormat) {
      logVoiceDebugEvent('recorder_unsupported', { platform: platformConfig.platform, isSupported, mimeType: recorderFormat?.mimeType, extension: recorderFormat?.extension });
      setError('unsupported');
      lifecycleBusyRef.current = false;
      setState('error');
      return false;
    }

    startInProgressRef.current = true;
    lifecycleBusyRef.current = true;
    manualStopOnlyRef.current = true;
    cancelledRef.current = false;
    stopAfterStartRef.current = false;
    cancelAfterStartRef.current = false;

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
        clearStartGuardTimer();
        startInProgressRef.current = false;
        recordingStartedAtRef.current = Date.now();
        logVoiceDebugEvent('recorder_started', {
          platform: platformConfig.platform,
          mimeType: recorder.mimeType || recorderFormat.mimeType,
          extension: recorderFormat.extension,
          recordingState: recorder.state,
          sessionMs: clampVoiceRecorderSessionMs(chunkMs),
          persistentStream: hasActiveTracks(rawStreamRef.current),
        });
        setState('recording');

        if (stopAfterStartRef.current || cancelAfterStartRef.current) {
          const shouldCancel = cancelAfterStartRef.current;
          logVoiceDebugEvent(shouldCancel ? 'voice_cancel_after_deferred_start' : 'voice_stop_after_deferred_start', {
            mimeType: recorder.mimeType || recorderFormat.mimeType,
            extension: recorderFormat.extension,
          });
          window.setTimeout(() => finalizeRecording(shouldCancel), 0);
          return;
        }

        startVoiceActivityWatcher(recorderFormat);

        finalizeTimerRef.current = window.setTimeout(() => {
          logVoiceDebugEvent('voice_max_session_reached_manual_hold', {
            elapsedMs: Date.now() - recordingStartedAtRef.current,
            peakRms: Number(vadPeakRmsRef.current.toFixed(4)),
            hadVoice: voiceDetectedRef.current,
            sessionMs: clampVoiceRecorderSessionMs(chunkMs),
            mimeType: recorderFormat.mimeType,
            extension: recorderFormat.extension,
            manualStopOnly: manualStopOnlyRef.current,
          });
          finalizeRecording(false);
        }, clampVoiceRecorderSessionMs(chunkMs));
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
        stopAfterStartRef.current = false;
        cancelAfterStartRef.current = false;
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        activeFormatRef.current = null;
        startInProgressRef.current = false;

        if (cancelledRef.current) {
          hardCleanup();
          setState('idle');
          return;
        }

        logVoiceDebugEvent('audio_blob_ready', { mimeType: format.mimeType, extension: format.extension, blobSize: blob.size, hadVoice });
        stopAllStreams();
        void uploadFinalBlob(blob, format, hadVoice, peakRms).finally(() => {
          cancelledRef.current = false;
        });
      };

      mediaRecorderRef.current = recorder;
      logVoiceDebugEvent('recorder_start_call', { platform: platformConfig.platform, mimeType: recorderFormat.mimeType, extension: recorderFormat.extension, sessionMs: clampVoiceRecorderSessionMs(chunkMs) });
      recorder.start(250);
      clearStartGuardTimer();
      startGuardTimerRef.current = window.setTimeout(() => {
        if (!startInProgressRef.current || mediaRecorderRef.current !== recorder) return;
        logVoiceDebugEvent('recorder_start_timeout', { platform: platformConfig.platform, mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });
        hardCleanup();
        setError('recording-error');
        setState('idle');
      }, 2400);
      return true;
    } catch (err) {
      startInProgressRef.current = false;
      lifecycleBusyRef.current = false;
      console.error(err);
      logVoiceDebugEvent('recorder_start_failed', { error: err instanceof Error ? err.name || err.message : 'unknown' });
      setError('microphone-denied');
      setState('error');
      hardCleanup();
      return false;
    }
  }, [chunkMs, ensureStream, finalizeRecording, hardCleanup, isSupported, platformConfig, recorderFormat, startVoiceActivityWatcher, state, uploadFinalBlob, clearFinalizeTimer, clearStartGuardTimer, stopVoiceActivityWatcher]);

  const stopRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_stop_and_send', { state, startInProgress: startInProgressRef.current });

    const recorder = mediaRecorderRef.current;
    if (startInProgressRef.current || (recorder && recorder.state === 'inactive' && state !== 'recording')) {
      stopAfterStartRef.current = true;
      cancelAfterStartRef.current = false;
      return;
    }

    finalizeRecording(false);
  }, [finalizeRecording, state]);

  const cancelRecording = useCallback(() => {
    logVoiceDebugEvent('voice_session_cancel', { state, startInProgress: startInProgressRef.current });

    const recorder = mediaRecorderRef.current;
    if (startInProgressRef.current || (recorder && recorder.state === 'inactive' && state !== 'recording')) {
      stopAfterStartRef.current = false;
      cancelAfterStartRef.current = true;
      cancelledRef.current = true;
      return;
    }

    finalizeRecording(true);
  }, [finalizeRecording, state]);

  const reset = useCallback(() => {
    hardCleanup();
    setError(null);
    setState('idle');
    startInProgressRef.current = false;
    lifecycleBusyRef.current = false;
    manualStopOnlyRef.current = false;
    stopAfterStartRef.current = false;
    cancelAfterStartRef.current = false;
  }, [hardCleanup]);

  const setManualStopOnly = useCallback((value: boolean) => {
    manualStopOnlyRef.current = value;
    logVoiceDebugEvent('voice_manual_stop_only_changed', { value, state });
  }, [state]);

  return {
    state,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    setManualStopOnly,
  };
}
