import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceBubbleTone, VoiceThought } from './voiceCapture.types';
import { compactVoiceBubble } from './voiceText';

const VOICE_BUBBLE_TIMEOUT_MS = 3600;

export function useVoiceThought() {
  const [thought, setThought] = useState<VoiceThought | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showThought = useCallback((text: string, tone: VoiceBubbleTone = 'neutral', timeoutMs = VOICE_BUBBLE_TIMEOUT_MS) => {
    const clean = compactVoiceBubble(text);
    if (!clean) return;

    clearTimer();
    setThought({ id: crypto.randomUUID(), text: clean, tone });
    timerRef.current = window.setTimeout(() => {
      setThought(null);
      timerRef.current = null;
    }, Math.max(900, timeoutMs));
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { thought, showThought };
}
