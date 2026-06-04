import type { ChatMessage } from '@/features/chat/model/chat.types';

export const MAX_LOCAL_MESSAGES = 50;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isClarificationPending(item: any) {
  const parsed = isRecord(item?.parsed) ? item.parsed : isRecord(item?.payload) ? item.payload : null;
  return Boolean(parsed && isRecord(parsed.clarification));
}

export function isConfirmationPending(item: any) {
  if (!item || (item.status && item.status !== 'pending')) return false;
  return !isClarificationPending(item);
}

export function appendLocalMessages(prev: ChatMessage[], next: ChatMessage | ChatMessage[]) {
  const additions = Array.isArray(next) ? next : [next];
  return [...prev, ...additions].slice(-MAX_LOCAL_MESSAGES);
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isTransientNetworkError(error: unknown) {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0;
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function emitPendingSync() {
  window.dispatchEvent(new CustomEvent('ai-financer:pending-sync'));
}
