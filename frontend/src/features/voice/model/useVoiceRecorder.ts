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

const DEFAULT_CHUNK_MS = 4200;
const MIN_AUDIO_BYTES = 900;
const MAX_SOFT_FAILURES = 3;

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

export function useVoiceRecorder({ onText, lang = 'ru-RU', chunkMs = DEFAULT_CHUNK_MS }: UseVoiceRecorderParams) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const activeFormatRef = useRef<RecorderFormat | null>(null);
  const uploadInFlightRef = useRef(false);
  const intentionallyStoppedRef = useRef(false);
  const softFailuresRef = useRef(0);
  const onTextRef = useRef(onText);
  const recordingStartedAtRef = useRef(0);

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

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopInternal = useCallback(() => {
    intentionallyStoppedRef.current = true;
    logVoiceDebugEvent('recorder_stop_requested', { state });

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    } else {
      cleanupStream();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      activeFormatRef.current = null;
      setState((current) => (current === 'error' ? current : 'idle'));
    }
  }, [cleanupStream]);

  const uploadChunk = useCallback(async (blob: Blob, format: RecorderFormat) => {
    if (uploadInFlightRef.current) {
      logVoiceDebugEvent('transcribe_skipped_in_flight', { blobSize: blob.size, mimeType: format.mimeType, extension: format.extension });
      return;
    }

    if (blob.size < MIN_AUDIO_BYTES) {
      logVoiceDebugEvent('audio_blob_too_small', { blobSize: blob.size, mimeType: format.mimeType, extension: format.extension });
      return;
    }

    uploadInFlightRef.current = true;
    logVoiceDebugEvent('transcribe_request_sent', { blobSize: blob.size, mimeType: format.mimeType, extension: format.extension });

    try {
      const result = await transcribeVoice(blob, `voice.${format.extension}`, toSttLanguage(lang));
      softFailuresRef.current = 0;
      logVoiceDebugEvent('transcribe_request_success', {
        status: 200,
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });

      const text = result.text?.trim();
      if (text) {
        await onTextRef.current(text);
      }
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status?: unknown }).status) : 0;
      logVoiceDebugEvent('transcribe_request_failed', {
        code,
        status,
        blobSize: blob.size,
        mimeType: format.mimeType,
        extension: format.extension,
      });

      if (code === 'VOICE_TRANSCRIPTION_NOT_CONFIGURED' || status === 503) {
        setError('transcription-not-configured');
        setState('error');
        stopInternal();
        return;
      }

      softFailuresRef.current += 1;
      if (softFailuresRef.current >= MAX_SOFT_FAILURES) {
        setError('transcription-error');
        setState('error');
        stopInternal();
      }
    } finally {
      uploadInFlightRef.current = false;
    }
  }, [lang, stopInternal]);

  const startRecording = useCallback(async () => {
    if (!isSupported || !recorderFormat) {
      logVoiceDebugEvent('recorder_unsupported', { isSupported, mimeType: recorderFormat?.mimeType, extension: recorderFormat?.extension });
      setError('unsupported');
      setState('error');
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') return;

    try {
      setError(null);
      softFailuresRef.current = 0;
      chunksRef.current = [];
      activeFormatRef.current = recorderFormat;
      intentionallyStoppedRef.current = false;

      logVoiceDebugEvent('permission_requested', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      logVoiceDebugEvent('permission_granted', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!intentionallyStoppedRef.current) {
            logVoiceDebugEvent('microphone_track_ended', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension });
            setError('microphone-ended');
            setState('error');
          }
        };
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: recorderFormat.mimeType,
      });

      recorder.ondataavailable = (event) => {
        const format = activeFormatRef.current ?? recorderFormat;
        if (!event.data || event.data.size <= 0) {
          logVoiceDebugEvent('audio_blob_empty', { mimeType: format.mimeType, extension: format.extension, blobSize: event.data?.size ?? 0 });
          return;
        }

        logVoiceDebugEvent('audio_blob_ready', { mimeType: format.mimeType, extension: format.extension, blobSize: event.data.size });
        void uploadChunk(event.data, format);
      };

      recorder.onstart = () => {
        recordingStartedAtRef.current = Date.now();
        logVoiceDebugEvent('recorder_started', {
          mimeType: recorder.mimeType || recorderFormat.mimeType,
          extension: recorderFormat.extension,
          recordingState: recorder.state,
        });
        setState('recording');
      };

      recorder.onerror = () => {
        logVoiceDebugEvent('recorder_error', { mimeType: recorder.mimeType || recorderFormat.mimeType, extension: recorderFormat.extension, recordingState: recorder.state });
        setError('recording-error');
        setState('error');
        stopInternal();
      };

      recorder.onstop = () => {
        logVoiceDebugEvent('recorder_stopped', {
          mimeType: recorder.mimeType || recorderFormat.mimeType,
          extension: recorderFormat.extension,
          elapsedMs: recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0,
        });
        cleanupStream();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        activeFormatRef.current = null;
        uploadInFlightRef.current = false;
        setState((current) => (current === 'error' ? current : 'idle'));
      };

      mediaRecorderRef.current = recorder;
      const timeslice = Math.max(2200, Math.min(9000, chunkMs));
      logVoiceDebugEvent('recorder_start_call', { mimeType: recorderFormat.mimeType, extension: recorderFormat.extension, elapsedMs: timeslice });
      recorder.start(timeslice);
    } catch (err) {
      console.error(err);
      logVoiceDebugEvent('recorder_start_failed', { error: err instanceof Error ? err.name || err.message : 'unknown' });
      setError('microphone-denied');
      setState('error');
      cleanupStream();
    }
  }, [chunkMs, cleanupStream, isSupported, recorderFormat, stopInternal, uploadChunk]);

  const stopRecording = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const cancelRecording = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const reset = useCallback(() => {
    stopInternal();
    setError(null);
    setState('idle');
    softFailuresRef.current = 0;
  }, [stopInternal]);

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
