import { env } from '@/shared/config/env';
import { getAccessToken } from '@/features/auth/lib/accessToken';
import { clearOfflineJsonCache, readOfflineJson, saveOfflineJson } from '@/shared/lib/performance/offlineJsonCache';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class HttpError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getAccessToken();

  const method = options.method ?? 'GET';
  let response: Response;

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (method === 'GET') {
      const cached = readOfflineJson<T>(path, token);
      if (cached !== null) return cached;
    }
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (response.ok && method === 'GET' && isJson) {
    saveOfflineJson(path, token, payload);
  }

  if (response.ok && method !== 'GET') {
    clearOfflineJsonCache(token);
  }

  if (!response.ok && method === 'GET') {
    const cached = readOfflineJson<T>(path, token);
    if (cached !== null) return cached;
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      ? String((payload as { error?: { message?: unknown }; message?: unknown }).error?.message
        || (payload as { message?: unknown }).message
        || `Request failed with status ${response.status}`)
      : `Request failed with status ${response.status}`;

    throw new HttpError(
      message,
      response.status,
      payload,
    );
  }

  return payload as T;
}