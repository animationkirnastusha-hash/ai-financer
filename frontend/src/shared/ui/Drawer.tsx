import { useEffect } from 'react';
import type React from 'react';
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
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('ai-any-modal-open', 'ai-core-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');

    return () => {
      document.body.classList.remove('ai-any-modal-open', 'ai-core-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).dataset.drawerBackdrop === 'true') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
      data-no-swipe="true"
      data-ai-core-modal="true"
      data-drawer-backdrop="true"
      onPointerDown={handleBackdropPointerDown}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-[28px] border border-white/10 bg-[#0d1218] p-4 shadow-2xl',
          className,
        )}
        data-no-swipe="true"
        data-ai-core-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {title ? <div className="mb-4 text-sm font-semibold text-white">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
