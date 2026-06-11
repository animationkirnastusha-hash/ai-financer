import type { AppLanguage } from '@/features/settings/model/settings.types';
import { combinedRuntimeTextDictionary } from '@/shared/lib/i18n/runtime-dictionary';

const normalizedRuntimeDictionary = new Map(
  Object.entries(combinedRuntimeTextDictionary).map(([key, value]) => [normalizeText(key), value]),
);

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function translateDynamicText(value: string): string | null {
  const normalized = normalizeText(value);
  const unread = normalized.match(/^(\d+) непрочитанных$/i);
  if (unread) return `${unread[1]} unread`;

  const accounts = normalized.match(/^(\d+)\s+(счетов|счётов|счета|счёта|счет|счёт)$/i);
  if (accounts) return `${accounts[1]} ${accounts[1] === '1' ? 'account' : 'accounts'}`;

  const unreadNotifications = normalized.match(/^(\d+)\s+новых уведомлен/i);
  if (unreadNotifications) return `${unreadNotifications[1]} new notifications`;

  const juneDate = normalized.match(/^(\d{1,2}) июня$/i);
  if (juneDate) return `${juneDate[1]} June`;

  return null;
}

export function translateRuntimeText(language: AppLanguage, value: string) {
  if (language === 'ru') return value;

  const normalized = normalizeText(value);
  if (!normalized) return value;

  const exact = normalizedRuntimeDictionary.get(normalized);
  if (exact) return value.replace(normalized, exact);

  const dynamic = translateDynamicText(normalized);
  if (dynamic) return value.replace(normalized, dynamic);

  return value;
}

export function hasRuntimeTranslation(value: string) {
  const normalized = normalizeText(value);
  return normalizedRuntimeDictionary.has(normalized) || Boolean(translateDynamicText(normalized));
}
