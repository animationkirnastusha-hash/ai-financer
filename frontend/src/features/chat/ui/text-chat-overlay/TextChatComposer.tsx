import type { FormEvent, KeyboardEvent, PointerEvent, RefObject } from 'react';

import type { VoiceInputState } from '@/features/voice/model/voice.types';

type Props = {
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  inputDisabled?: boolean;
  voiceState: VoiceInputState;
  isVoicePressed: boolean;
  isVoiceCancelledBySwipe: boolean;
  placeholder: string;
  sendLabel: string;
  voiceLabel: string;
  voiceCancelHint: string;
  voiceCancelledLabel: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onVoicePointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function TextChatComposer({
  value,
  inputRef,
  isSending,
  inputDisabled = false,
  voiceState,
  isVoicePressed,
  isVoiceCancelledBySwipe,
  placeholder,
  sendLabel,
  voiceLabel,
  voiceCancelHint,
  voiceCancelledLabel,
  onValueChange,
  onSubmit,
  onVoicePointerDown,
  onVoicePointerMove,
  onVoicePointerEnd,
  onVoicePointerCancel,
}: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void onSubmit();
  };

  return (
    <form className="text-chat-overlay__composer" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={isSending || inputDisabled}
      />
      {isVoicePressed || voiceState === 'recording' ? (
        <div className="text-chat-overlay__voice-cancel-hint" data-cancelled={isVoiceCancelledBySwipe ? 'true' : 'false'}>
          {isVoiceCancelledBySwipe ? voiceCancelledLabel : voiceCancelHint}
        </div>
      ) : null}
      {value.trim() ? (
        <button type="submit" disabled={isSending || inputDisabled} aria-label={sendLabel}>
          ↑
        </button>
      ) : (
        <button
          type="button"
          className="text-chat-overlay__voice-send"
          data-recording={isVoicePressed || voiceState === 'recording' ? 'true' : 'false'}
          disabled={isSending || inputDisabled || voiceState === 'uploading'}
          aria-label={voiceLabel}
          onPointerDown={onVoicePointerDown}
          onPointerMove={onVoicePointerMove}
          onPointerUp={onVoicePointerEnd}
          onPointerCancel={onVoicePointerCancel}
        >
          {isVoiceCancelledBySwipe ? '×' : '●'}
        </button>
      )}
    </form>
  );
}
