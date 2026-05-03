import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

type SurfaceProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Surface({ children, className, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/8 bg-white/[0.04] backdrop-blur-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}