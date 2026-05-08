import { useCallback, useRef, useState } from 'react';
import { transcribeVoice } from '@/features/voice/api/voice.api';

type VoiceRecorderState = 'idle' | 'recording' | 'uploading' | 'error';

type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
};

export function useVoiceRecorder({ onText }: UseVoiceRecorderParams) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const shouldSubmitRef = useRef(true);

  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(
    typeof window !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== 'undefined',
  );

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('unsupported');
      setState('error');
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];
      shouldSubmitRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
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

          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const result = await transcribeVoice(blob);

          if (!result.text?.trim()) {
            setError('no-speech');
            setState('idle');
            return;
          }

          await onText(result.text.trim());
          setState('idle');
        } catch (err) {
          console.error(err);
          setError('transcription-error');
          setState('error');
        } finally {
          cleanupStream();
          chunksRef.current = [];
          shouldSubmitRef.current = true;
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
  }, [cleanupStream, isSupported, onText]);

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
