import { useCallback, useRef, useState, type TouchEvent } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

const EDGE_START_ZONE_MIN_PX = 120;
const EDGE_START_ZONE_MAX_PX = 260;
const EDGE_START_ZONE_SCREEN_SHARE = 0.42;
const ACTIVATE_SWIPE_PX = 8;
const OPEN_SWIPE_PX = 76;
const MAX_VISUAL_SWIPE_PX = 112;
const MAX_VERTICAL_DRIFT_PX = 78;

const SAFE_CHAT_SWIPE_SCREENS = new Set<AppScreen>([
  'dashboard',
  'accounts',
  'analytics',
  'journal',
  'goals',
  'obligations',
  'spending-limits',
  'profile',
  'settings',
  'sections',
  'companion',
  'store',
  'premium',
  'business-accountant',
  'receipt-scans',
  'referral',
  'admin',
]);

function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function hasActiveEditableElement() {
  const active = document.activeElement;
  if (!isHTMLElement(active)) return false;

  return Boolean(active.closest('input, textarea, select, [contenteditable="true"]'));
}

function hasBlockingLayer() {
  return Boolean(
    document.body.classList.contains('product-tour-active') ||
    document.documentElement.classList.contains('product-tour-active') ||
    document.querySelector('[role="dialog"], .product-tour, .app-modal-backdrop, .app-modal-sheet, .bottom-sheet, .app-navigation-sheet'),
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!isHTMLElement(target)) return false;

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
        'form',
        '[role="button"]',
        '[role="tab"]',
        '[role="switch"]',
        '[contenteditable="true"]',
      ].join(', '),
    ),
  );
}

function hasHorizontalScrollTarget(target: EventTarget | null) {
  if (!isHTMLElement(target)) return false;

  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScrollX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 4;
    if (canScrollX) return true;
    node = node.parentElement;
  }

  return false;
}

function getEdgeStartZonePx(root: HTMLElement) {
  const rootWidth = root.getBoundingClientRect().width || window.innerWidth;

  return Math.min(
    EDGE_START_ZONE_MAX_PX,
    Math.max(EDGE_START_ZONE_MIN_PX, rootWidth * EDGE_START_ZONE_SCREEN_SHARE),
  );
}

type UseFinaPullGestureOptions = {
  blocked?: boolean;
  currentScreen: AppScreen;
  openModal: (modal: AppModalDescriptor) => void;
};

export function canUseFinaPullOnScreen(screen: AppScreen) {
  return SAFE_CHAT_SWIPE_SCREENS.has(screen);
}

export function useFinaPullGesture({ blocked = false, currentScreen, openModal }: UseFinaPullGestureOptions) {
  const rootRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    blocked: boolean;
  } | null>(null);
  const pullOffsetRef = useRef(0);
  const [pullOffset, setPullOffset] = useState(0);
  const [isReadyToOpen, setIsReadyToOpen] = useState(false);

  const setVisualOffset = useCallback((offset: number) => {
    const nextOffset = Math.min(MAX_VISUAL_SWIPE_PX, Math.max(0, offset));
    pullOffsetRef.current = nextOffset;
    setPullOffset(nextOffset);
    setIsReadyToOpen(nextOffset >= OPEN_SWIPE_PX);
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    pullOffsetRef.current = 0;
    setPullOffset(0);
    setIsReadyToOpen(false);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    const root = rootRef.current;
    if (!touch || !root) return;

    const rootRect = root.getBoundingClientRect();
    const startFromRight = rootRect.right - touch.clientX;
    const shouldBlock =
      blocked ||
      !canUseFinaPullOnScreen(currentScreen) ||
      hasActiveEditableElement() ||
      hasBlockingLayer() ||
      startFromRight < 0 ||
      startFromRight > getEdgeStartZonePx(root) ||
      isInteractiveTarget(event.target) ||
      hasHorizontalScrollTarget(event.target);

    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: false,
      blocked: shouldBlock,
    };
  }, [blocked, currentScreen]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const origin = startRef.current;
    const touch = event.touches[0];
    if (!origin || !touch || origin.blocked) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (dx >= -ACTIVATE_SWIPE_PX) return;
    if (absDy > MAX_VERTICAL_DRIFT_PX || absDy > absDx * 0.86) {
      origin.blocked = true;
      setVisualOffset(0);
      return;
    }

    origin.active = true;
    event.preventDefault();
    event.stopPropagation();

    setVisualOffset(-dx);
  }, [setVisualOffset]);

  const onTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    const origin = startRef.current;
    const shouldOpen = Boolean(origin?.active && !origin.blocked && pullOffsetRef.current >= OPEN_SWIPE_PX);

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
  }, [openModal, reset]);

  const onTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    rootRef,
    pullOffset,
    isReadyToOpen,
    isEnabled: canUseFinaPullOnScreen(currentScreen) && !blocked,
    gestureHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  };
}
