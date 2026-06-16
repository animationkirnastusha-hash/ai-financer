import { useCallback, useRef, useState, type TouchEvent } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

const DASHBOARD_MIN_START_ZONE_PX = 320;
const DASHBOARD_MAX_START_ZONE_PX = 680;
const DASHBOARD_START_ZONE_SCREEN_SHARE = 0.72;
const SAFE_PAGE_MIN_START_ZONE_PX = 124;
const SAFE_PAGE_MAX_START_ZONE_PX = 240;
const SAFE_PAGE_START_ZONE_SCREEN_SHARE = 0.30;
const ACTIVATE_DRAG_PX = 4;
const OPEN_DRAG_PX = 38;
const MAX_VISUAL_DRAG_PX = 104;
const MAX_HORIZONTAL_DRIFT_PX = 86;

const SAFE_PULL_SCREENS = new Set<AppScreen>([
  'dashboard',
  'accounts',
  'analytics',
  'journal',
  'goals',
  'obligations',
  'spending-limits',
  'profile',
  'store',
  'premium',
  'business-accountant',
  'receipt-scans',
  'referral',
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

function findScrollRoot(target: EventTarget | null, root: HTMLElement) {
  if (isHTMLElement(target)) {
    const closestPage = target.closest<HTMLElement>('.app-page');
    if (closestPage && root.contains(closestPage)) return closestPage;
  }

  return root.querySelector<HTMLElement>('.app-page') ?? root;
}

function isScrollableParentBusy(target: EventTarget | null, scrollRoot: HTMLElement) {
  if (!isHTMLElement(target)) return false;

  let node: HTMLElement | null = target;
  while (node && node !== scrollRoot) {
    const style = window.getComputedStyle(node);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (canScrollY) return true;
    node = node.parentElement;
  }

  return false;
}

function getStartZonePx(scrollRoot: HTMLElement, screen: AppScreen) {
  const rootHeight = scrollRoot.getBoundingClientRect().height || window.innerHeight;
  const isDashboard = screen === 'dashboard';
  const min = isDashboard ? DASHBOARD_MIN_START_ZONE_PX : SAFE_PAGE_MIN_START_ZONE_PX;
  const max = isDashboard ? DASHBOARD_MAX_START_ZONE_PX : SAFE_PAGE_MAX_START_ZONE_PX;
  const share = isDashboard ? DASHBOARD_START_ZONE_SCREEN_SHARE : SAFE_PAGE_START_ZONE_SCREEN_SHARE;

  return Math.min(max, Math.max(min, rootHeight * share));
}

type UseFinaPullGestureOptions = {
  blocked?: boolean;
  currentScreen: AppScreen;
  openModal: (modal: AppModalDescriptor) => void;
};

export function canUseFinaPullOnScreen(screen: AppScreen) {
  return SAFE_PULL_SCREENS.has(screen);
}

export function useFinaPullGesture({ blocked = false, currentScreen, openModal }: UseFinaPullGestureOptions) {
  const rootRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    blocked: boolean;
    scrollRoot: HTMLElement | null;
  } | null>(null);
  const pullOffsetRef = useRef(0);
  const [pullOffset, setPullOffset] = useState(0);
  const [isReadyToOpen, setIsReadyToOpen] = useState(false);

  const setVisualOffset = useCallback((offset: number) => {
    const nextOffset = Math.min(MAX_VISUAL_DRAG_PX, Math.max(0, offset));
    pullOffsetRef.current = nextOffset;
    setPullOffset(nextOffset);
    setIsReadyToOpen(nextOffset >= OPEN_DRAG_PX);
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

    const scrollRoot = findScrollRoot(event.target, root);
    const rootTop = scrollRoot.getBoundingClientRect().top;
    const startYInRoot = touch.clientY - rootTop;
    const rootAtTop = scrollRoot.scrollTop <= 2;
    const shouldBlock =
      blocked ||
      !canUseFinaPullOnScreen(currentScreen) ||
      hasActiveEditableElement() ||
      hasBlockingLayer() ||
      !rootAtTop ||
      startYInRoot < 0 ||
      startYInRoot > getStartZonePx(scrollRoot, currentScreen) ||
      isInteractiveTarget(event.target) ||
      isScrollableParentBusy(event.target, scrollRoot);

    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: false,
      blocked: shouldBlock,
      scrollRoot,
    };
  }, [blocked, currentScreen]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const origin = startRef.current;
    const touch = event.touches[0];
    if (!origin || !touch || origin.blocked || !origin.scrollRoot) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    const absDx = Math.abs(dx);

    if (dy <= ACTIVATE_DRAG_PX) return;
    if (absDx > MAX_HORIZONTAL_DRIFT_PX || absDx > dy * 0.78) {
      origin.blocked = true;
      setVisualOffset(0);
      return;
    }
    if (origin.scrollRoot.scrollTop > 2) {
      origin.blocked = true;
      setVisualOffset(0);
      return;
    }

    origin.active = true;
    event.preventDefault();
    event.stopPropagation();

    setVisualOffset(dy);
  }, [setVisualOffset]);

  const onTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    const origin = startRef.current;
    const shouldOpen = Boolean(origin?.active && !origin.blocked && pullOffsetRef.current >= OPEN_DRAG_PX);

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
