const SW_PATH = '/sw.js';

export function registerAppCache() {
  if (import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_PATH).catch(() => {
      // Cache is optional. The app must work without service worker support.
    });
  });
}
