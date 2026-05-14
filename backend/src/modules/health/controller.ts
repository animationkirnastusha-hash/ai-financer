import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../shared/utils/asyncHandler';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;

  res.json({
    status: 'ok',
    service: 'ai-finance-backend',
    env: env.nodeEnv,
    aiMode: env.aiMode,
    aiProvider: env.aiProvider,
    checks: {
      db: 'ok',
      ai: env.aiProvider === 'groq' ? 'external' : env.aiProvider,
    },
    timestamp: new Date().toISOString(),
  });
});
