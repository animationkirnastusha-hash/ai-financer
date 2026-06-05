import type { PropsWithChildren } from 'react';

import { AuthBootstrap } from './AuthBootstrap';
import { TelegramBootstrap } from './TelegramBootstrap';
import { FinanceBootstrap } from './FinanceBootstrap';
import { LanguageRuntimeProvider } from './LanguageRuntimeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <TelegramBootstrap />
      <AuthBootstrap>
        <FinanceBootstrap />
        <LanguageRuntimeProvider>{children}</LanguageRuntimeProvider>
      </AuthBootstrap>
    </>
  );
}