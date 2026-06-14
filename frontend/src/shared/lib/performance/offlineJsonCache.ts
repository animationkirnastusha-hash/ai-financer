const CACHE_PREFIX = 'ai-financer:http-cache:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

type CacheEnvelope<T> = {
  savedAt: number;
  payload: T;
};

function hashToken(value: string | null) {
  if (!value) return 'public';
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cacheKey(path: string, token: string | null) {
  return `${CACHE_PREFIX}${hashToken(token)}:${path}`;
}

export function saveOfflineJson<T>(path: string, token: string | null, payload: T) {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), payload };
    localStorage.setItem(cacheKey(path, token), JSON.stringify(envelope));
  } catch {
    // Offline cache is optional.
  }
}

export function readOfflineJson<T>(path: string, token: string | null): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(path, token));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope.savedAt !== 'number') return null;
    if (Date.now() - envelope.savedAt > CACHE_TTL_MS) return null;
    return envelope.payload;
  } catch {
    return null;
  }
}
