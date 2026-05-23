import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onClose?: () => void;
  disabled?: boolean;
  inline?: boolean;
};

export function AICoreInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  inline = false,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [value]);

  useEffect(() => {
    document.body.classList.toggle('ai-composer-focused', focused);

    return () => {
      document.body.classList.remove('ai-composer-focused');
    };
  }, [focused]);

  const submit = async () => {
    if (disabled || !value.trim()) return;
    await onSubmit();
    window.setTimeout(() => inputRef.current?.focus(), 40);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    await submit();
  };

  return (
    <div
      className={inline ? "app-ai-inline-composer" : "fixed bottom-[calc(env(safe-area-inset-bottom)+42px)] left-0 right-0 z-[90] mx-auto w-full max-w-[560px] px-4"}
      data-ai-composer="true"
      data-no-swipe="true"
    >
      <div className="rounded-[28px] border border-white/10 bg-[#0b1016]/95 p-2 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите команду..."
            rows={1}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-[22px] border border-white/8 bg-black/25 px-4 py-3 text-base leading-6 text-white outline-none placeholder:text-white/30"
          />

          {value.trim() ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange('')}
              disabled={disabled}
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-white/55 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Очистить ввод"
            >
              ×
            </button>
          ) : null}

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/16 text-lg text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Отправить"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
