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
      <div className="rounded-[26px] border border-white/10 bg-[#0b1016]/95 p-2 shadow-2xl backdrop-blur-xl">
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
            placeholder="Кофе 350, +50000 зарплата..."
            rows={1}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-base text-white outline-none placeholder:text-white/30"
          />

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSubmit}
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