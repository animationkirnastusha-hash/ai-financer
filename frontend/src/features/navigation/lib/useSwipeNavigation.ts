import { useEffect, useRef } from 'react';
import { telegramHaptic } from '@/shared/lib/telegram';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Options = {
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
};

export const MAIN_SWIPE_SCREENS: AppScreen[] = ['transactions', 'dashboard', 'analytics'];

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, button, select, [data-no-swipe="true"], [data-ai-core-modal="true"]'),
  );
}

function isBlockedByUi() {
  return (
    document.body.classList.contains('ai-voice-gesture-active') ||
    document.body.classList.contains('ai-composer-focused') ||
    document.body.classList.contains('ai-core-modal-open') ||
    document.body.classList.contains('ai-any-modal-open') ||
    document.body.classList.contains('ai-modal-open')
  );
}

function markSwipeDirection(direction: 'left' | 'right') {
  document.documentElement.dataset.aiSwipeDir = direction;
  window.setTimeout(() => {
    if (document.documentElement.dataset.aiSwipeDir === direction) {
      delete document.documentElement.dataset.aiSwipeDir;
    }
  }, 380);
}

export function useSwipeNavigation({ currentScreen, navigateTo, goBack }: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startedOnInteractive = useRef(false);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startedOnInteractive.current = isBlockedByUi() || isInteractiveTarget(event.target);
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (startedOnInteractive.current || isBlockedByUi()) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      if (Math.abs(deltaX) < 64 || Math.abs(deltaY) > 76) return;

      const currentIndex = MAIN_SWIPE_SCREENS.indexOf(currentScreen);

      if (currentIndex !== -1) {
        const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
        const nextScreen = MAIN_SWIPE_SCREENS[nextIndex];
        if (!nextScreen) return;

        markSwipeDirection(deltaX < 0 ? 'left' : 'right');
        navigateTo(nextScreen);
        telegramHaptic('light');
        return;
      }

      if (deltaX > 0) {
        markSwipeDirection('right');
        goBack();
        telegramHaptic('light');
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentScreen, goBack, navigateTo]);

  return {
    mainScreens: MAIN_SWIPE_SCREENS,
  };
}
