import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
};

export function Button({
  children,
  className,
  variant = 'primary',
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50',
        variant === 'primary' && 'bg-emerald-400 text-black',
        variant === 'secondary' && 'border border-white/10 bg-white/8 text-white',
        variant === 'ghost' && 'bg-transparent text-white/80',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}