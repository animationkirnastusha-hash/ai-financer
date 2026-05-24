import { useCallback, useMemo, useRef, useState } from 'react';
import { transcribeVoice } from '@/features/voice/api/voice.api';

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

const HARD_PROVIDER_ERROR_CODES = new Set([
  'VOICE_GLADIA_UPLOAD_FAILED',
  'VOICE_GLADIA_CREATE_FAILED',
  'VOICE_GLADIA_POLL_FAILED',
  'VOICE_GLADIA_TRANSCRIPTION_ERROR',
  'VOICE_GLADIA_TIMEOUT',
  'VOICE_DEEPGRAM_REQUEST_FAILED',
  'VOICE_ASSEMBLYAI_UPLOAD_FAILED',
  'VOICE_ASSEMBLYAI_CREATE_FAILED',
  'VOICE_ASSEMBLYAI_POLL_FAILED',
]);

function getBestRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const formats: RecorderFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/aac', extension: 'aac' },
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
    if (uploadInFlightRef.current) return;
    if (blob.size < MIN_AUDIO_BYTES) return;

    uploadInFlightRef.current = true;

    try {
      const result = await transcribeVoice(blob, `voice.${format.extension}`, toSttLanguage(lang));
      softFailuresRef.current = 0;

      const text = result.text?.trim();
      if (text) {
        await onTextRef.current(text);
      }
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status?: unknown }).status) : 0;

      if (code === 'VOICE_TRANSCRIPTION_NOT_CONFIGURED' || status === 503) {
        setError('transcription-not-configured');
        setState('error');
        stopInternal();
        return;
      }

      if (HARD_PROVIDER_ERROR_CODES.has(code) || status === 401 || status === 403) {
        setError('transcription-provider-error');
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!intentionallyStoppedRef.current) {
            setError('microphone-ended');
            setState('error');
          }
        };
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: recorderFormat.mimeType,
      });

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) return;
        const format = activeFormatRef.current ?? recorderFormat;
        void uploadChunk(event.data, format);
      };

      recorder.onstart = () => {
        setState('recording');
      };

      recorder.onerror = () => {
        setError('recording-error');
        setState('error');
        stopInternal();
      };

      recorder.onstop = () => {
        cleanupStream();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        activeFormatRef.current = null;
        uploadInFlightRef.current = false;
        setState((current) => (current === 'error' ? current : 'idle'));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(Math.max(2200, Math.min(9000, chunkMs)));
    } catch (err) {
      console.error(err);
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
