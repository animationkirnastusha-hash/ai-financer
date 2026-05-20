import { useCallback, useMemo, useRef, useState } from 'react';
import { transcribeVoice } from '@/features/voice/api/voice.api';

type VoiceRecorderState = 'idle' | 'recording' | 'uploading' | 'error';

type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
};

type RecorderFormat = {
  mimeType: string;
  extension: string;
};

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

export function useVoiceRecorder({ onText }: UseVoiceRecorderParams) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const shouldSubmitRef = useRef(true);
  const activeFormatRef = useRef<RecorderFormat | null>(null);

  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

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

  const startRecording = useCallback(async () => {
    if (!isSupported || !recorderFormat) {
      setError('unsupported');
      setState('error');
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];
      shouldSubmitRef.current = true;
      activeFormatRef.current = recorderFormat;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: recorderFormat.mimeType,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setState('recording');
      };

      recorder.onerror = () => {
        setError('recording-error');
        setState('error');
      };

      recorder.onstop = async () => {
        try {
          if (!shouldSubmitRef.current) {
            setState('idle');
            return;
          }

          setState('uploading');

          const format = activeFormatRef.current ?? recorderFormat;
          const blob = new Blob(chunksRef.current, { type: format.mimeType });
          const result = await transcribeVoice(blob, `voice.${format.extension}`);

          if (!result.text?.trim()) {
            setError('no-speech');
            setState('idle');
            return;
          }

          await onText(result.text.trim());
          setState('idle');
        } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : 'transcription-error');
          setState('error');
        } finally {
          cleanupStream();
          chunksRef.current = [];
          shouldSubmitRef.current = true;
          activeFormatRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.error(err);
      setError('microphone-denied');
      setState('error');
      cleanupStream();
    }
  }, [cleanupStream, isSupported, onText, recorderFormat]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    shouldSubmitRef.current = true;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    shouldSubmitRef.current = false;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupStream();
      chunksRef.current = [];
      activeFormatRef.current = null;
      setState('idle');
    }
  }, [cleanupStream]);

  const reset = useCallback(() => {
    cancelRecording();
    setError(null);
    setState('idle');
  }, [cancelRecording]);

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
