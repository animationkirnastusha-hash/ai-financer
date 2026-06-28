import type { PointerEvent } from 'react';

import type { VoiceInputState } from '@/features/voice';

type Props = {
  isVoicePressed: boolean;
  voiceState: VoiceInputState;
  prompts: string[];
  voiceLabel: string;
  title: string;
  caption: string;
  onPrompt: (prompt: string) => void;
  onVoicePointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function TextChatEmptyState({
  isVoicePressed,
  voiceState,
  prompts,
  voiceLabel,
  title,
  caption,
  onPrompt,
  onVoicePointerDown,
  onVoicePointerMove,
  onVoicePointerEnd,
  onVoicePointerCancel,
}: Props) {
  return (
    <div className="text-chat-overlay__empty text-chat-overlay__empty--reminder">
      <button
        type="button"
        className={
          isVoicePressed || voiceState === 'recording'
            ? 'text-chat-overlay__orb text-chat-overlay__orb--active'
            : 'text-chat-overlay__orb'
        }
        aria-label={voiceLabel}
        onPointerDown={onVoicePointerDown}
        onPointerMove={onVoicePointerMove}
        onPointerUp={onVoicePointerEnd}
        onPointerCancel={onVoicePointerCancel}
      >
        ⌁
      </button>
      <h3>{title}</h3>
      <p>{caption}</p>
      {prompts.length ? (
        <div className="text-chat-overlay__chips">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
