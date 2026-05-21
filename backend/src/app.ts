import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import apiRoutes from './routes';
import { env } from './config/env';
import healthRoutes from './modules/health/routes';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { apiMonitoringMiddleware } from './middleware/api-monitoring';
import adminRoutes from './modules/admin/routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const isAllowedOrigin =
          env.corsOrigins.includes(origin) ||
          /^https:\/\/[a-z0-9-]+\.ai-financer\.pages\.dev$/.test(origin);

        if (isAllowedOrigin) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(compression());
  app.use(morgan(env.isDevelopment ? 'dev' : 'combined'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRoutes);

  const monitoredApi = [apiMonitoringMiddleware, rateLimit({ windowMs: 60_000, max: 120 })] as const;

  // Admin routes are mounted explicitly as well as through apiRoutes.
  // This keeps the closed admin panel reachable even if an older routes/index.js
  // remains in a deployed dist bundle during incremental server updates.
  app.use('/api/admin', ...monitoredApi, adminRoutes);
  app.use('/admin', ...monitoredApi, adminRoutes);

  app.use('/api', ...monitoredApi, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}