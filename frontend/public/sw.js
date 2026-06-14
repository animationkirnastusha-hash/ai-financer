const APP_CACHE_NAME = 'ai-financer-app-v2';
const STATIC_CACHE_NAME = 'ai-financer-static-v2';
const STATIC_EXTENSIONS = ['.js', '.css', '.svg', '.png', '.webp', '.woff2'];
const APP_SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE_NAME);
    await cache.addAll(APP_SHELL).catch(() => undefined);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== APP_CACHE_NAME && key !== STATIC_CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || await networkPromise || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) return;

  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  if (request.mode === 'navigate' || acceptsHtml) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(APP_CACHE_NAME);
        if (response.ok) await cache.put('/', response.clone());
        return response;
      } catch {
        const cached = await caches.match('/') || await caches.match('/index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  const shouldCacheStatic = STATIC_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
  if (!shouldCacheStatic) return;

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));
});
