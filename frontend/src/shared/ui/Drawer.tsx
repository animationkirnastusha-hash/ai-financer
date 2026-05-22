import { useEffect } from 'react';
import type React from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}>;

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  className,
  bodyClassName,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('ai-any-modal-open', 'ai-core-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('ai-any-modal-open', 'ai-core-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).dataset.drawerBackdrop === 'true') onClose();
  };

  return (
    <div
      className="app-modal-backdrop"
      data-no-swipe="true"
      data-ai-core-modal="true"
      data-drawer-backdrop="true"
      onPointerDown={handleBackdropPointerDown}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div
        className={cn('app-modal-sheet', className)}
        data-no-swipe="true"
        data-ai-core-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-handle" />
        {(title || subtitle) ? (
          <header className="app-modal-header">
            <div className="min-w-0">
              {title ? <h2 className="app-modal-title">{title}</h2> : null}
              {subtitle ? <p className="app-modal-subtitle">{subtitle}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="app-icon-button" aria-label="Закрыть">
              ×
            </button>
          </header>
        ) : null}
        <div className={cn('app-modal-body', bodyClassName)}>{children}</div>
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
