import { useEffect } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { getTelegramClientLanguageCode, initTelegramMiniApp } from '@/shared/lib/telegram';

export function TelegramBootstrap() {
  const applyTelegramLanguage = useSettingsStore((state) => state.applyTelegramLanguage);

  useEffect(() => {
    initTelegramMiniApp();
    applyTelegramLanguage(getTelegramClientLanguageCode());
  }, [applyTelegramLanguage]);

  return null;
}
