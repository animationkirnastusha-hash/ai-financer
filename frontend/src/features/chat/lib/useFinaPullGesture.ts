import { useCallback, useRef, useState, type TouchEvent } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

const START_ZONE_PX = 148;
const ACTIVATE_DRAG_PX = 16;
const OPEN_DRAG_PX = 86;
const MAX_VISUAL_DRAG_PX = 112;
const MAX_HORIZONTAL_DRIFT_PX = 70;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        '[data-no-fina-pull="true"]',
        '[data-no-swipe="true"]',
        'button',
        'a',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[contenteditable="true"]',
      ].join(', '),
    ),
  );
}

function isScrollableParentBusy(target: EventTarget | null, root: HTMLElement | null) {
  if (!(target instanceof HTMLElement) || !root) return false;

  let node: HTMLElement | null = target;
  while (node && node !== root) {
    const style = window.getComputedStyle(node);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (canScrollY && node.scrollTop > 0) return true;
    node = node.parentElement;
  }

  return false;
}

type UseFinaPullGestureOptions = {
  blocked?: boolean;
  openModal: (modal: AppModalDescriptor) => void;
};

export function useFinaPullGesture({ blocked = false, openModal }: UseFinaPullGestureOptions) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    blocked: boolean;
  } | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const [isReadyToOpen, setIsReadyToOpen] = useState(false);

  const reset = useCallback(() => {
    startRef.current = null;
    setPullOffset(0);
    setIsReadyToOpen(false);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const root = rootRef.current;
    if (!touch || !root) return;

    const rootTop = root.getBoundingClientRect().top;
    const startYInRoot = touch.clientY - rootTop;
    const rootAtTop = root.scrollTop <= 2;
    const shouldBlock =
      blocked ||
      !rootAtTop ||
      startYInRoot > START_ZONE_PX ||
      isInteractiveTarget(event.target) ||
      isScrollableParentBusy(event.target, root);

    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: false,
      blocked: shouldBlock,
    };
  }, [blocked]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const origin = startRef.current;
    const touch = event.touches[0];
    const root = rootRef.current;
    if (!origin || !touch || !root || origin.blocked) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    const absDx = Math.abs(dx);

    if (dy <= ACTIVATE_DRAG_PX) return;
    if (absDx > MAX_HORIZONTAL_DRIFT_PX || absDx > dy * 0.72) {
      origin.blocked = true;
      setPullOffset(0);
      setIsReadyToOpen(false);
      return;
    }
    if (root.scrollTop > 2) {
      origin.blocked = true;
      setPullOffset(0);
      setIsReadyToOpen(false);
      return;
    }

    origin.active = true;
    event.preventDefault();
    event.stopPropagation();

    const nextOffset = Math.min(MAX_VISUAL_DRAG_PX, Math.max(0, dy));
    setPullOffset(nextOffset);
    setIsReadyToOpen(nextOffset >= OPEN_DRAG_PX);
  }, []);

  const onTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const origin = startRef.current;
    const shouldOpen = Boolean(origin?.active && !origin.blocked && pullOffset >= OPEN_DRAG_PX);

    if (origin?.active) {
      event.preventDefault();
      event.stopPropagation();
    }

    reset();

    if (shouldOpen) {
      window.requestAnimationFrame(() => {
        openModal({ type: 'ai-text-overlay', mode: 'text' });
      });
    }
  }, [openModal, pullOffset, reset]);

  const onTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    rootRef,
    pullOffset,
    isReadyToOpen,
    gestureHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  };
}
