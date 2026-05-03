import { useEffect } from 'react';
import { initTelegramMiniApp } from '@/shared/lib/telegram';

export function TelegramBootstrap() {
  useEffect(() => {
    initTelegramMiniApp();
  }, []);

  return null;
}