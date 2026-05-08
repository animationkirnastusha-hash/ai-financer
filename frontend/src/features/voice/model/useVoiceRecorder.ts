import { useCallback, useRef, useState } from 'react';
import { transcribeVoice } from '@/features/voice/api/voice.api';

type VoiceRecorderState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'error';

type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
};

type StartRecordingResult = 'recording' | 'permission-granted' | 'error';

type MicrophonePermissionName = PermissionName | 'microphone';

async function readMicrophonePermissionState(): Promise<PermissionState | 'unknown'> {
  if (typeof navigator === 'undefined') return 'unknown';
  if (!navigator.permissions?.query) return 'unknown';

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as MicrophonePermissionName,
    });

    return status.state;
  } catch {
    return 'unknown';
  }
}

export function useVoiceRecorder({ onText }: UseVoiceRecorderParams) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cancelCurrentRecordingRef = useRef(false);
  const permissionPrimedRef = useRef(false);

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

  const requestMicrophoneOnly = useCallback(async (): Promise<StartRecordingResult> => {
    if (!isSupported) {
      setError('unsupported');
      setState('error');
      return 'error';
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      permissionPrimedRef.current = true;
      setState('idle');
      return 'permission-granted';
    } catch (err) {
      console.error(err);
      setError('microphone-denied');
      setState('error');
      return 'error';
    }
  }, [isSupported]);

  const startRecording = useCallback(async (): Promise<StartRecordingResult> => {
    if (!isSupported) {
      setError('unsupported');
      setState('error');
      return 'error';
    }

    const permissionState = await readMicrophonePermissionState();

    if (permissionState === 'prompt' || (!permissionPrimedRef.current && permissionState === 'unknown')) {
      return requestMicrophoneOnly();
    }

    try {
      setError(null);
      chunksRef.current = [];
      cancelCurrentRecordingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionPrimedRef.current = true;
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
          if (cancelCurrentRecordingRef.current) {
            chunksRef.current = [];
            setState('idle');
            return;
          }

          setState('uploading');

          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

          if (blob.size <= 0) {
            setError('no-speech');
            setState('idle');
            return;
          }

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
          cancelCurrentRecordingRef.current = false;
          cleanupStream();
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      return 'recording';
    } catch (err) {
      console.error(err);
      setError('microphone-denied');
      setState('error');
      cleanupStream();
      return 'error';
    }
  }, [cleanupStream, isSupported, onText, requestMicrophoneOnly]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelCurrentRecordingRef.current = true;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    cleanupStream();
    chunksRef.current = [];
    setError(null);
    setState('idle');
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
