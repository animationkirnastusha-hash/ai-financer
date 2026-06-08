import { useEffect, useRef, useState } from 'react';
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
  layer?: number;
}>;

const DISMISS_DRAG_PX = 72;

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  className,
  bodyClassName,
  layer,
  children,
}: DrawerProps) {
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

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

  const handleDragPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStartYRef.current = event.clientY;
    setDragOffset(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleDragPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(Math.min(140, dy));
  };

  const handleDragPointerEnd = () => {
    if (dragOffset >= DISMISS_DRAG_PX) onClose();
    dragStartYRef.current = null;
    setDragOffset(0);
  };

  const hasHeaderText = Boolean(title || subtitle);

  return (
    <div
      className="app-modal-backdrop"
      style={layer ? { zIndex: layer } : undefined}
      data-no-swipe="true"
      data-ai-core-modal="true"
      data-drawer-backdrop="true"
      onPointerDown={handleBackdropPointerDown}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div
        className={cn('app-modal-sheet', className)}
        style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined }}
        data-no-swipe="true"
        data-ai-core-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="app-modal-handle"
          aria-label="Скрыть"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerEnd}
          onPointerCancel={handleDragPointerEnd}
        >
          <span />
        </button>
        {hasHeaderText ? (
          <header className="app-modal-header">
            <div className="min-w-0">
              {title ? <h2 className="app-modal-title">{title}</h2> : null}
              {subtitle ? <p className="app-modal-subtitle">{subtitle}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="app-icon-button" aria-label="Закрыть">
              ×
            </button>
          </header>
        ) : (
          <button type="button" onClick={onClose} className="app-modal-close-floating app-icon-button" aria-label="Закрыть">
            ×
          </button>
        )}
        <div className={cn('app-modal-body', bodyClassName)}>{children}</div>
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
