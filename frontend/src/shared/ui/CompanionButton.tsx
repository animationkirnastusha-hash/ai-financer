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

export function CompanionButton({ mood = 'calm', size = 'md', label = 'AI companion', className = '', ...props }: Props) {
  const tone = mood === 'warning' ? 'from-amber-200/80' : mood === 'focused' ? 'from-sky-200/80' : 'from-emerald-200/80';

  return (
    <button
      type="button"
      aria-label={label}
      className={`group relative grid ${sizes[size]} place-items-center rounded-full border border-white/14 bg-black/45 shadow-2xl transition active:scale-95 ${className}`}
      {...props}
    >
      <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${tone} via-white/10 to-transparent opacity-55 blur-[1px]`} />
      <span className="absolute inset-[7px] rounded-full border border-white/16 bg-[#061118]" />
      <span className="relative h-1/2 w-1/2 rounded-full bg-white/85 shadow-[0_0_24px_rgba(167,243,208,0.45)] transition group-active:scale-90" />
    </button>
  );
}
