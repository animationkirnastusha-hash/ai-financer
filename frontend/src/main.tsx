import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppRouter } from '@/app/router/AppRouter';
import { AppProviders } from '@/app/providers/AppProviders';

import { registerAppCache } from '@/shared/lib/performance/registerAppCache';
import { lockViewportZoom } from '@/shared/lib/dom/lockViewportZoom';

import '@/index.css';

registerAppCache();
lockViewportZoom();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);