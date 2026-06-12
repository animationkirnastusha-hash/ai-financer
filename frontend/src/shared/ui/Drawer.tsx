import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/lib/i18n';

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

const DISMISS_DRAG_PX = 84;
const ACTIVATE_DRAG_PX = 8;
const CANCEL_UPWARD_DRAG_PX = -10;
const SHEET_TOP_DRAG_ZONE_RATIO = 0.55;
const SHEET_TOP_DRAG_ZONE_MIN_PX = 260;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, option, button, a, [role="button"], [data-modal-drag-ignore="true"]'));
}

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
  const { t } = useI18n();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const dragIsActiveRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const setModalDragOffset = (value: number) => {
    dragOffsetRef.current = value;
    setDragOffset(value);
  };

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

  const resetDrag = () => {
    dragStartYRef.current = null;
    dragPointerIdRef.current = null;
    dragIsActiveRef.current = false;
    setModalDragOffset(0);
  };

  const activateDrag = (target: HTMLElement, pointerId: number) => {
    dragIsActiveRef.current = true;
    dragPointerIdRef.current = pointerId;
    target.setPointerCapture?.(pointerId);
  };

  const canStartSheetDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    if (isInteractiveTarget(event.target)) return false;

    const sheet = sheetRef.current;
    if (!sheet) return false;

    const rect = sheet.getBoundingClientRect();
    const yInsideSheet = event.clientY - rect.top;
    const topDragZone = Math.max(rect.height * SHEET_TOP_DRAG_ZONE_RATIO, SHEET_TOP_DRAG_ZONE_MIN_PX);
    if (yInsideSheet > topDragZone) return false;

    const body = bodyRef.current;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('.app-modal-body') && body && body.scrollTop > 2) return false;

    return true;
  };

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).dataset.drawerBackdrop === 'true') onClose();
  };

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!canStartSheetDrag(event)) return;
    dragStartYRef.current = event.clientY;
    dragPointerIdRef.current = event.pointerId;
    dragIsActiveRef.current = false;
    setModalDragOffset(0);
  };

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null || dragPointerIdRef.current !== event.pointerId) return;

    const dy = event.clientY - dragStartYRef.current;
    if (!dragIsActiveRef.current) {
      if (dy <= CANCEL_UPWARD_DRAG_PX) {
        resetDrag();
        return;
      }
      if (dy < ACTIVATE_DRAG_PX) return;
      activateDrag(event.currentTarget, event.pointerId);
    }

    event.preventDefault();
    setModalDragOffset(Math.min(180, Math.max(0, dy)));
  };

  const handleSheetPointerEnd = () => {
    if (dragIsActiveRef.current && dragOffsetRef.current >= DISMISS_DRAG_PX) onClose();
    resetDrag();
  };

  const handleDragPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dragStartYRef.current = event.clientY;
    setModalDragOffset(0);
    activateDrag(event.currentTarget, event.pointerId);
  };

  const handleDragPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (dragStartYRef.current === null || dragPointerIdRef.current !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - dragStartYRef.current);
    if (dy > 0) event.preventDefault();
    setModalDragOffset(Math.min(180, dy));
  };

  const handleDragPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (dragOffsetRef.current >= DISMISS_DRAG_PX) onClose();
    resetDrag();
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
        ref={sheetRef}
        className={cn('app-modal-sheet', className)}
        style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined }}
        data-no-swipe="true"
        data-ai-core-modal="true"
        onPointerDown={handleSheetPointerDown}
        onPointerMove={handleSheetPointerMove}
        onPointerUp={handleSheetPointerEnd}
        onPointerCancel={handleSheetPointerEnd}
      >
        <button
          type="button"
          className="app-modal-handle"
          aria-label={t('common.close')}
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
            <button type="button" onClick={onClose} className="app-icon-button" aria-label={t('common.close')}>
              ×
            </button>
          </header>
        ) : (
          <button type="button" onClick={onClose} className="app-modal-close-floating app-icon-button" aria-label={t('common.close')}>
            ×
          </button>
        )}
        <div ref={bodyRef} className={cn('app-modal-body', bodyClassName)}>{children}</div>
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
