import { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { monitoringService } from '../modules/monitoring/monitoring.instance';

export function apiMonitoringMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    monitoringService.recordApiMetric({
      method: req.method,
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl.split('?')[0] || req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId ?? null,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}
