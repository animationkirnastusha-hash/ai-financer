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
    timestamp: new Date().toISOString(),
  });
});