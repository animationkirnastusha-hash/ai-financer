/**
 * Global left/right page swipes are intentionally disabled.
 * Local gestures remain inside cards, sheets and nested screens.
 */
export function useSwipeNavigation() {
  return {
    onTouchStart: undefined,
    onTouchMove: undefined,
    onTouchEnd: undefined,
  };
}
