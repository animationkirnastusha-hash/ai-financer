import { HttpError } from '@/shared/api/http';

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatSubscriptionDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

export function formatDuration(ms: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} мс`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  return `${Math.round(sec / 60)} мин`;
}

export function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    const payload = error.payload as string | { error?: { message?: string; code?: string }; message?: string } | null;
    if (typeof payload === 'string') return payload || `HTTP ${error.status}`;
    if (payload && typeof payload === 'object') return payload.error?.message || payload.message || `HTTP ${error.status}`;
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка';
}
