let viewportZoomLocked = false;

export function lockViewportZoom() {
  if (viewportZoomLocked || typeof document === 'undefined') return;
  viewportZoomLocked = true;

  const preventGestureZoom = (event: Event) => {
    event.preventDefault();
  };

  let lastTouchEndAt = 0;
  const preventDoubleTapZoom = (event: TouchEvent) => {
    const now = Date.now();
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      lastTouchEndAt = now;
      return;
    }

    if (now - lastTouchEndAt < 320) event.preventDefault();
    lastTouchEndAt = now;
  };

  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('gestureend', preventGestureZoom, { passive: false });
  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
}
