import type { ChangeEvent, FormEvent, KeyboardEvent, PointerEvent, RefObject } from 'react';

import { RECEIPT_ACCEPTED_TYPES } from '@/features/chat/ui/text-chat-overlay/constants';
import type { VoiceInputState } from '@/features/voice/model/voice.types';

type Props = {
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  receiptCameraInputRef: RefObject<HTMLInputElement | null>;
  receiptFileInputRef: RefObject<HTMLInputElement | null>;
  hasReceiptAccess: boolean;
  isReceiptUploading: boolean;
  isSending: boolean;
  voiceState: VoiceInputState;
  isVoicePressed: boolean;
  isVoiceCancelledBySwipe: boolean;
  placeholder: string;
  sendLabel: string;
  voiceLabel: string;
  receiptActionLabel: string;
  receiptCameraLabel: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onReceiptFile: (file: File | null) => void | Promise<void>;
  onVoicePointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onVoicePointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function TextChatComposer({
  value,
  inputRef,
  receiptCameraInputRef,
  receiptFileInputRef,
  hasReceiptAccess,
  isReceiptUploading,
  isSending,
  voiceState,
  isVoicePressed,
  isVoiceCancelledBySwipe,
  placeholder,
  sendLabel,
  voiceLabel,
  receiptActionLabel,
  receiptCameraLabel,
  onValueChange,
  onSubmit,
  onReceiptFile,
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void onReceiptFile(event.target.files?.[0] ?? null);
  };

  return (
    <form className="text-chat-overlay__composer" onSubmit={handleSubmit}>
      {hasReceiptAccess ? (
        <div className="text-chat-overlay__receipt-actions">
          <button
            type="button"
            className="text-chat-overlay__receipt-main"
            disabled={isReceiptUploading}
            onClick={() => receiptFileInputRef.current?.click()}
          >
            {receiptActionLabel}
          </button>
          <button
            type="button"
            className="text-chat-overlay__receipt-mini"
            disabled={isReceiptUploading}
            onClick={() => receiptCameraInputRef.current?.click()}
            aria-label={receiptCameraLabel}
          >
            ◉
          </button>
          <input
            ref={receiptCameraInputRef}
            type="file"
            accept={RECEIPT_ACCEPTED_TYPES}
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
          />
          <input
            ref={receiptFileInputRef}
            type="file"
            accept={RECEIPT_ACCEPTED_TYPES}
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={isSending}
      />
      {value.trim() ? (
        <button type="submit" disabled={isSending} aria-label={sendLabel}>
          ↑
        </button>
      ) : (
        <button
          type="button"
          className="text-chat-overlay__voice-send"
          data-recording={isVoicePressed || voiceState === 'recording' ? 'true' : 'false'}
          disabled={isSending || voiceState === 'uploading'}
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
