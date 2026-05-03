import type { PropsWithChildren } from 'react';

import { AuthBootstrap } from './AuthBootstrap';
import { TelegramBootstrap } from './TelegramBootstrap';
import { FinanceBootstrap } from './FinanceBootstrap';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <TelegramBootstrap />
      <AuthBootstrap>
        <FinanceBootstrap />
        {children}
      </AuthBootstrap>
    </>
  );
}