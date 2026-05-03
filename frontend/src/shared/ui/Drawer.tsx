import type { PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}>;

export function Drawer({
  open,
  onClose,
  title,
  className,
  children,
}: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-[28px] border border-white/10 bg-[#0d1218] p-4 shadow-2xl',
          className,
        )}
      >
        {title ? (
          <div className="mb-4 text-sm font-semibold text-white">{title}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}