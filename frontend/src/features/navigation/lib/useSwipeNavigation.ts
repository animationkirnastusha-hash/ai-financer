import { useEffect, useRef } from 'react';
import { telegramHaptic } from '@/shared/lib/telegram';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Options = {
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
};

export const MAIN_SWIPE_SCREENS: AppScreen[] = ['transactions', 'dashboard', 'analytics'];

const LOCK_DISTANCE = 18;
const NAVIGATE_DISTANCE = 54;
const NAVIGATE_VELOCITY = 0.34;
const MAX_DRAG = 112;
const MIN_HORIZONTAL_RATIO = 1.22;
const EDGE_BACK_ZONE = 56;
const MAX_VERTICAL_BEFORE_LOCK = 22;
const MAX_VERTICAL_AFTER_LOCK = 72;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, a, button, [role="button"], [contenteditable="true"], [data-no-swipe="true"], [data-ai-core-modal="true"], .app-modal-backdrop, .app-modal-sheet, .app-bottom-sheet, .drawer-backdrop, .drawer-sheet',
    ),
  );
}

function isScrollableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
    if (canScrollY) return true;
    node = node.parentElement;
  }
  return false;
}

function isBlockedByUi() {
  return (
    document.body.classList.contains('ai-voice-gesture-active') ||
    document.body.classList.contains('ai-composer-focused') ||
    document.body.classList.contains('ai-core-modal-open') ||
    document.body.classList.contains('ai-any-modal-open') ||
    document.body.classList.contains('ai-modal-open') ||
    Boolean(document.querySelector('.app-modal-backdrop, [data-ai-core-modal="true"], .drawer-backdrop, .app-bottom-sheet'))
  );
}

function setSwipeDirection(direction: 'left' | 'right') {
  document.body.classList.remove('ai-screen-slide-left', 'ai-screen-slide-right', 'ai-screen-dragging', 'ai-screen-snap-back');
  document.documentElement.style.setProperty('--ai-swipe-drag-x', '0px');
  document.body.classList.add(direction === 'left' ? 'ai-screen-slide-left' : 'ai-screen-slide-right');
  window.setTimeout(() => {
    document.body.classList.remove('ai-screen-slide-left', 'ai-screen-slide-right');
  }, 310);
}

function resetDrag(animate = true) {
  if (animate) {
    document.body.classList.add('ai-screen-snap-back');
    window.setTimeout(() => document.body.classList.remove('ai-screen-snap-back'), 190);
  }
  document.body.classList.remove('ai-screen-dragging');
  document.documentElement.style.setProperty('--ai-swipe-drag-x', '0px');
}

function rubberBand(deltaX: number) {
  const sign = deltaX < 0 ? -1 : 1;
  const abs = Math.abs(deltaX);
  const value = Math.min(MAX_DRAG, abs * 0.52 + Math.sqrt(abs) * 2.8);
  return sign * value;
}

export function useSwipeNavigation({ currentScreen, navigateTo, goBack }: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const startAt = useRef(0);
  const blockedStart = useRef(false);
  const scrollableStart = useRef(false);
  const lockedHorizontal = useRef(false);
  const canSwipeRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const applyDrag = (value: number) => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        document.body.classList.add('ai-screen-dragging');
        document.documentElement.style.setProperty('--ai-swipe-drag-x', `${value}px`);
        rafRef.current = null;
      });
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      blockedStart.current = isBlockedByUi() || isInteractiveTarget(event.target);
      scrollableStart.current = isScrollableTarget(event.target);
      lockedHorizontal.current = false;
      canSwipeRef.current = false;
      startX.current = touch.clientX;
      lastX.current = touch.clientX;
      startY.current = touch.clientY;
      lastY.current = touch.clientY;
      startAt.current = Date.now();
      resetDrag(false);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (blockedStart.current || isBlockedByUi()) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      lastX.current = touch.clientX;
      lastY.current = touch.clientY;

      if (!lockedHorizontal.current) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX < LOCK_DISTANCE) return;
        if (absY > MAX_VERTICAL_BEFORE_LOCK && absY > absX * 0.55) return;
        if (scrollableStart.current && absY > 8 && absY >= absX * 0.72) return;
        if (absX / Math.max(1, absY) < MIN_HORIZONTAL_RATIO) return;
        lockedHorizontal.current = true;
      }

      if (Math.abs(deltaY) > MAX_VERTICAL_AFTER_LOCK && Math.abs(deltaY) > Math.abs(deltaX) * 0.9) {
        resetDrag();
        canSwipeRef.current = false;
        return;
      }

      const currentIndex = MAIN_SWIPE_SCREENS.indexOf(currentScreen);
      const canGoMain = currentIndex !== -1
        ? Boolean(MAIN_SWIPE_SCREENS[deltaX < 0 ? currentIndex + 1 : currentIndex - 1])
        : deltaX > 0 && (startX.current <= EDGE_BACK_ZONE || Math.abs(deltaX) > NAVIGATE_DISTANCE * 1.15);

      canSwipeRef.current = canGoMain;
      if (!canGoMain) {
        resetDrag();
        return;
      }

      if (event.cancelable) event.preventDefault();
      applyDrag(rubberBand(deltaX));
    };

    const handleTouchEnd = () => {
      if (blockedStart.current || !lockedHorizontal.current || isBlockedByUi() || !canSwipeRef.current) {
        resetDrag();
        return;
      }

      const deltaX = lastX.current - startX.current;
      const deltaY = lastY.current - startY.current;
      const elapsed = Math.max(1, Date.now() - startAt.current);
      const velocity = Math.abs(deltaX) / elapsed;
      const isHorizontal = Math.abs(deltaX) / Math.max(1, Math.abs(deltaY)) >= MIN_HORIZONTAL_RATIO;
      const shouldNavigate = isHorizontal && (Math.abs(deltaX) >= NAVIGATE_DISTANCE || velocity >= NAVIGATE_VELOCITY);

      if (!shouldNavigate) {
        resetDrag();
        return;
      }

      const currentIndex = MAIN_SWIPE_SCREENS.indexOf(currentScreen);

      if (currentIndex !== -1) {
        const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
        const nextScreen = MAIN_SWIPE_SCREENS[nextIndex];
        if (!nextScreen) {
          resetDrag();
          return;
        }

        setSwipeDirection(deltaX < 0 ? 'left' : 'right');
        navigateTo(nextScreen);
        telegramHaptic('light');
        return;
      }

      if (deltaX > 0) {
        setSwipeDirection('right');
        goBack();
        telegramHaptic('light');
        return;
      }

      resetDrag();
    };

    const handleTouchCancel = () => resetDrag();

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      resetDrag(false);
    };
  }, [currentScreen, goBack, navigateTo]);

  return { mainScreens: MAIN_SWIPE_SCREENS };
}
