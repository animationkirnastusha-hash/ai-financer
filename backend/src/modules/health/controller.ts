import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../shared/utils/asyncHandler';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {
    db: 'ok',
    aiProvider: env.aiProvider,
  };

  await prisma.$queryRaw`SELECT 1`;

  res.json({
    status: checks.db === 'ok' ? 'ok' : 'degraded',
    service: 'ai-finance-backend',
    env: env.nodeEnv,
    aiMode: env.aiMode,
    aiProvider: env.aiProvider,
    checks,
    timestamp: new Date().toISOString(),
  });
});
