import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_BUBBLE_TIMEOUT_MS } from '@/features/voice/model/voiceConstants';
import type { VoiceThought, VoiceBubbleTone } from '@/features/voice/model/voiceSession.types';
import { compactVoiceBubble } from '@/features/voice/model/voiceText';
import type { ShowVoiceThought } from '@/features/voice/ui/companion/voiceCompanion.types';

export function useVoiceCompanionThought() {
  const [thought, setThought] = useState<VoiceThought | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const lastThoughtRef = useRef<{ text: string; tone: VoiceBubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });

  const showThought = useCallback<ShowVoiceThought>((text, tone = 'neutral', timeoutMs = VOICE_BUBBLE_TIMEOUT_MS) => {
    const cleanText = compactVoiceBubble(text);
    if (!cleanText) return;

    const now = Date.now();
    const lastThought = lastThoughtRef.current;
    if (lastThought.text === cleanText && lastThought.tone === tone && now - lastThought.at < 1400) return;
    lastThoughtRef.current = { text: cleanText, tone, at: now };

    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    setThought({ id: `${tone}-${now}`, text: cleanText, tone });

    bubbleTimerRef.current = window.setTimeout(() => {
      setThought(null);
      bubbleTimerRef.current = null;
    }, timeoutMs);
  }, []);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
  }, []);

  return { thought, showThought };
}
