import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../shared/utils/asyncHandler';

async function checkOllama() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
    });

    return response.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timeout);
  }
}

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const checks = {
    db: 'ok',
    ollama: await checkOllama(),
  };

  await prisma.$queryRaw`SELECT 1`;

  res.json({
    status: checks.db === 'ok' ? 'ok' : 'degraded',
    service: 'ai-finance-backend',
    env: env.nodeEnv,
    aiMode: env.aiMode,
    checks,
    timestamp: new Date().toISOString(),
  });
});
