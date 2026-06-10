import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppRouter } from '@/app/router/AppRouter';
import { AppProviders } from '@/app/providers/AppProviders';

import { registerAppCache } from '@/shared/lib/performance/registerAppCache';

import '@/index.css';

registerAppCache();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);