import { useMemo, useRef, type TouchEvent } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

const MIN_SWIPE_X = 76;
const MAX_VERTICAL_DRIFT = 68;

function closestNoSwipe(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-no-swipe="true"], input, textarea, select, button, a'));
}

/**
 * Main screen-to-screen swipes are disabled.
 * A right swipe only works as a back gesture for nested screens.
 */
export function useSwipeNavigation() {
  const goBack = useNavigationStore((state) => state.goBack);
  const historyLength = useNavigationStore((state) => state.history.length);
  const start = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  return useMemo(() => ({
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (!touch) return;
      start.current = {
        x: touch.clientX,
        y: touch.clientY,
        blocked: closestNoSwipe(event.target),
      };
    },
    onTouchMove: undefined,
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      if (!origin || origin.blocked || historyLength <= 0) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - origin.x;
      const dy = Math.abs(touch.clientY - origin.y);

      if (dx >= MIN_SWIPE_X && dy <= MAX_VERTICAL_DRIFT) {
        goBack();
      }
    },
  }), [goBack, historyLength]);
}
