import { useEffect, useRef } from 'react';
import { telegramHaptic } from '@/shared/lib/telegram';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Options = {
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
};

export const MAIN_SWIPE_SCREENS: AppScreen[] = ['transactions', 'dashboard', 'analytics'];

const START_LOCK_DISTANCE = 4;
const NAVIGATE_DISTANCE = 34;
const NAVIGATE_VELOCITY = 0.22;
const MAX_DRAG = 138;
const MAX_VERTICAL_DRIFT = 190;
const MIN_HORIZONTAL_RATIO = 0.30;
const EDGE_BACK_ZONE = 42;
const MAX_TAP_MS = 80;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      'input, textarea, button, select, a, [role="button"], [contenteditable="true"], [data-no-swipe="true"], [data-ai-core-modal="true"], .app-modal-backdrop, .app-modal-sheet',
    ),
  );
}

function isBlockedByUi() {
  return (
    document.body.classList.contains('ai-voice-gesture-active') ||
    document.body.classList.contains('ai-composer-focused') ||
    document.body.classList.contains('ai-core-modal-open') ||
    document.body.classList.contains('ai-any-modal-open') ||
    document.body.classList.contains('ai-modal-open') ||
    Boolean(document.querySelector('.app-modal-backdrop, [data-ai-core-modal="true"]'))
  );
}

function setSwipeDirection(direction: 'left' | 'right') {
  document.body.classList.remove('ai-screen-slide-left', 'ai-screen-slide-right', 'ai-screen-dragging', 'ai-screen-drag-ready');
  document.documentElement.style.setProperty('--ai-swipe-drag-x', '0px');
  document.body.classList.add(direction === 'left' ? 'ai-screen-slide-left' : 'ai-screen-slide-right');
  window.setTimeout(() => {
    document.body.classList.remove('ai-screen-slide-left', 'ai-screen-slide-right');
  }, 460);
}

function resetDrag() {
  document.body.classList.remove('ai-screen-dragging', 'ai-screen-drag-ready');
  document.documentElement.style.setProperty('--ai-swipe-drag-x', '0px');
}

function rubberBand(deltaX: number) {
  const sign = deltaX < 0 ? -1 : 1;
  const value = Math.min(MAX_DRAG, Math.pow(Math.abs(deltaX), 0.86) * 2.55);
  return sign * value;
}

export function useSwipeNavigation({ currentScreen, navigateTo, goBack }: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const startAt = useRef(0);
  const startedOnInteractive = useRef(false);
  const lockedHorizontal = useRef(false);
  const canSwipeRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startedOnInteractive.current = isBlockedByUi() || isInteractiveTarget(event.target);
      lockedHorizontal.current = false;
      canSwipeRef.current = false;
      startX.current = touch.clientX;
      lastX.current = touch.clientX;
      startY.current = touch.clientY;
      lastY.current = touch.clientY;
      startAt.current = Date.now();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resetDrag();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startedOnInteractive.current || isBlockedByUi()) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      lastX.current = touch.clientX;
      lastY.current = touch.clientY;

      if (!lockedHorizontal.current) {
        if (Math.abs(deltaX) < START_LOCK_DISTANCE) return;
        if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT) return;
        if (Math.abs(deltaX) / Math.max(1, Math.abs(deltaY)) < MIN_HORIZONTAL_RATIO) return;
        if (Date.now() - startAt.current < MAX_TAP_MS && Math.abs(deltaX) < 14) return;
        lockedHorizontal.current = true;
      }

      const currentIndex = MAIN_SWIPE_SCREENS.indexOf(currentScreen);
      const canGoMain = currentIndex !== -1
        ? Boolean(MAIN_SWIPE_SCREENS[deltaX < 0 ? currentIndex + 1 : currentIndex - 1])
        : deltaX > 0 && (startX.current <= EDGE_BACK_ZONE || Math.abs(deltaX) > NAVIGATE_DISTANCE + 12);

      canSwipeRef.current = canGoMain;
      if (!canGoMain) {
        resetDrag();
        return;
      }

      if (event.cancelable) event.preventDefault();
      document.body.classList.add('ai-screen-dragging');
      if (Math.abs(deltaX) > NAVIGATE_DISTANCE * 0.72) document.body.classList.add('ai-screen-drag-ready');
      else document.body.classList.remove('ai-screen-drag-ready');

      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      const nextDrag = rubberBand(deltaX);
      rafRef.current = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--ai-swipe-drag-x', `${nextDrag}px`);
        rafRef.current = null;
      });
    };

    const handleTouchEnd = () => {
      if (startedOnInteractive.current || !lockedHorizontal.current || isBlockedByUi() || !canSwipeRef.current) {
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

    const handleTouchCancel = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resetDrag();
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resetDrag();
    };
  }, [currentScreen, goBack, navigateTo]);

  return {
    mainScreens: MAIN_SWIPE_SCREENS,
  };
}
