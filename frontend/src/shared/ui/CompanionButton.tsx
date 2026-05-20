import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  mood?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const sizes = {
  sm: 'h-11 w-11',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
};

export function CompanionButton({
  mood = 'calm',
  size = 'md',
  label = 'AI companion',
  className = '',
  ...props
}: Props) {
  const tone = mood === 'warning' ? 'bg-amber-200/70' : mood === 'focused' ? 'bg-sky-200/75' : 'bg-emerald-200/75';

  return (
    <button
      type="button"
      aria-label={label}
      className={`ai-companion-control group relative grid ${sizes[size]} select-none place-items-center overflow-hidden rounded-full border border-white/14 bg-[#071018]/86 shadow-[0_0_34px_rgba(110,231,183,0.18)] transition active:scale-95 ${className}`}
      draggable={false}
      data-no-swipe="true"
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,0.22),transparent_26%),radial-gradient(circle_at_50%_86%,rgba(16,185,129,0.20),transparent_48%)]" />
      <span className="pointer-events-none absolute inset-[5px] rounded-full border border-emerald-200/12 bg-[#091821]" />
      <span className="pointer-events-none absolute inset-[10px] rounded-full border border-white/8 bg-[#0c1d24]" />

      <span className="pointer-events-none relative flex h-[62%] w-[48%] flex-col items-center justify-center rounded-[45%] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]">
        <span className="mb-1 flex gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${tone} shadow-[0_0_10px_rgba(167,243,208,0.75)]`} />
          <span className={`h-1.5 w-1.5 rounded-full ${tone} shadow-[0_0_10px_rgba(167,243,208,0.75)]`} />
        </span>
        <span className="h-[1px] w-4 rounded-full bg-white/24" />
      </span>

      <span className="pointer-events-none absolute bottom-2 h-4 w-8 rounded-t-full border border-white/8 bg-white/[0.035]" />
    </button>
  );
}
