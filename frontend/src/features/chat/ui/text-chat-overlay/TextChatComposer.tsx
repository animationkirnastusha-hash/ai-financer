import type { FormEvent, KeyboardEvent, RefObject } from 'react';

type Props = {
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  inputDisabled?: boolean;
  placeholder: string;
  sendLabel: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function TextChatComposer({
  value,
  inputRef,
  isSending,
  inputDisabled = false,
  placeholder,
  sendLabel,
  onValueChange,
  onSubmit,
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
      <button type="submit" disabled={isSending || inputDisabled || !value.trim()} aria-label={sendLabel}>
        ↑
      </button>
    </form>
  );
}
