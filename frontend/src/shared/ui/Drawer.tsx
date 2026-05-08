import { useEffect, type PropsWithChildren } from 'react';
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
  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]" data-no-swipe="true" data-ai-core-modal="true">
      <button
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0d1218] p-4 shadow-2xl',
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
