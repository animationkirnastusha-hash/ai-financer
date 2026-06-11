import { useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import type { AppLanguage } from '@/features/settings/model/settings.types';
import { dictionary } from '@/shared/lib/i18n/locales';
import { hasRuntimeTranslation, translateRuntimeText } from '@/shared/lib/i18n/runtime';

export type { I18nKey } from '@/shared/lib/i18n/locales';
export { hasRuntimeTranslation, translateRuntimeText };

export function translate(language: AppLanguage, key: string, params?: Record<string, string | number>) {
  const table = (dictionary[language] ?? dictionary.ru) as Record<string, string>;
  const ruTable = dictionary.ru as Record<string, string>;
  let value: string = table[key] ?? ruTable[key] ?? key;
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${param}}`, String(replacement));
    }
  }
  return value;
}

export function useI18n() {
  const language = useSettingsStore((state) => state.appLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const rt = useCallback((value: string) => translateRuntimeText(language, value), [language]);

  return useMemo(() => ({ language, t, rt }), [language, t, rt]);
}
