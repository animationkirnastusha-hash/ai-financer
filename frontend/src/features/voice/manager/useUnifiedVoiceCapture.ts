import { useCallback, useEffect, useRef } from 'react';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import type { VoiceCue } from '@/features/voice/api/voice.api';

type UseUnifiedVoiceCaptureParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
  permissionWasPrompted?: boolean;
  watchdogMs?: number;
  onWatchdogTimeout?: () => void;
};

export function useUnifiedVoiceCapture({
  onText,
  lang = 'ru-RU',
  sessionMs,
  permissionWasPrompted = false,
  watchdogMs,
  onWatchdogTimeout,
}: UseUnifiedVoiceCaptureParams) {
  const voice = useVoiceInput({ onText, lang, sessionMs, permissionWasPrompted });
  const timeoutHandlerRef = useRef(onWatchdogTimeout);
  timeoutHandlerRef.current = onWatchdogTimeout;

  const resetCapture = useCallback(() => {
    voice.cancel();
    voice.reset?.();
  }, [voice]);

  const primePermission = useCallback(async () => {
    const allowed = await voice.primePermission();
    voice.reset?.();
    return allowed;
  }, [voice]);

  const start = useCallback(async () => {
    const result = await voice.start();
    if (result !== 'started' && result !== 'busy') {
      voice.reset?.();
    }
    return result;
  }, [voice]);

  const speak = useCallback((text: string, options?: { maxDurationMs?: number; cue?: VoiceCue }) => {
    voice.speak(text, options);
  }, [voice]);

  useEffect(() => {
    if (voice.state !== 'recording' && voice.state !== 'uploading') return;

    const timeoutMs = watchdogMs ?? (voice.state === 'recording'
      ? Math.max((sessionMs ?? 5200) + 5200, 11000)
      : 26000);

    const timer = window.setTimeout(() => {
      resetCapture();
      timeoutHandlerRef.current?.();
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [resetCapture, sessionMs, voice.state, watchdogMs]);

  return {
    ...voice,
    start,
    primePermission,
    resetCapture,
    speak,
  };
}
