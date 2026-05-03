import { useEffect, useRef } from 'react';
import { telegramHaptic } from '@/shared/lib/telegram';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Options = {
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
};

const MAIN_SCREENS: AppScreen[] = ['dashboard', 'ai-core', 'settings'];

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, button, select, [data-no-swipe="true"]'),
  );
}

export function useSwipeNavigation({ currentScreen, navigateTo }: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startedOnInteractive = useRef(false);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startedOnInteractive.current = isInteractiveTarget(event.target);
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (startedOnInteractive.current) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      if (Math.abs(deltaX) < 72 || Math.abs(deltaY) > 70) return;

      const currentIndex = MAIN_SCREENS.indexOf(currentScreen);
      if (currentIndex === -1) return;

      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextScreen = MAIN_SCREENS[nextIndex];

      if (!nextScreen) return;

      navigateTo(nextScreen);
      telegramHaptic('light');
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentScreen, navigateTo]);

  return {
    mainScreens: MAIN_SCREENS,
  };
}