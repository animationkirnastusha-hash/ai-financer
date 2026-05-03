import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

type IconButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function IconButton({
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white transition active:scale-[0.98] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}