import type { VoiceThought } from '@/features/voice';

export function VoiceThoughtBubble({ thought }: { thought: VoiceThought | null }) {
  if (!thought) return null;

  return (
    <div className={`voice-first-bubble voice-first-bubble--${thought.tone}`}>
      {thought.text}
    </div>
  );
}
