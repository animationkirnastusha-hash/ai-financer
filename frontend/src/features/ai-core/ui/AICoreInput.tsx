import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onClose?: () => void;
  disabled?: boolean;
};

export function AICoreInput({
  value,
  onChange,
  onSubmit,
  onClose,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [value]);

  const submit = async () => {
    if (disabled || !value.trim()) return;
    await onSubmit();
    inputRef.current?.focus();
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    await submit();
  };

  return (
    <div
      className={`z-[90] mx-auto w-full max-w-[560px] px-4 transition-all ${
        focused
          ? 'fixed bottom-[calc(env(safe-area-inset-bottom)+8px)] left-0 right-0'
          : ''
      }`}
      data-ai-composer="true"
      data-no-swipe="true"
    >
      <div className="rounded-[28px] border border-white/10 bg-[#0b1016]/95 p-2 shadow-2xl backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={value}
            onFocus={() => {
              setFocused(true);
              document.body.classList.add('ai-composer-focused');
            }}
            onBlur={() => {
              setFocused(false);
              document.body.classList.remove('ai-composer-focused');
            }}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Кофе 350, +50000 зарплата..."
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

        {focused ? (
          <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] text-white/35">
            <span>Enter — отправить, Shift+Enter — новая строка</span>

            {onClose ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClose}
                className="text-white/45"
              >
                Свернуть
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
