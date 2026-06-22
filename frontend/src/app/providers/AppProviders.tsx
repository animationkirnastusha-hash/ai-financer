import type { PropsWithChildren } from 'react';

import { AuthBootstrap } from './AuthBootstrap';
import { TelegramBootstrap } from './TelegramBootstrap';
import { FinanceBootstrap } from './FinanceBootstrap';
import { LanguageRuntimeProvider } from './LanguageRuntimeProvider';
import { OverlayAppearanceBridge } from '@/features/settings/ui/OverlayAppearanceBridge';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <TelegramBootstrap />
      <AuthBootstrap>
        <OverlayAppearanceBridge />
        <FinanceBootstrap />
        <LanguageRuntimeProvider>{children}</LanguageRuntimeProvider>
      </AuthBootstrap>
    </>
  );
}