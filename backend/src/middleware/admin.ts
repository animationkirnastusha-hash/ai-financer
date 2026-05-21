import { NextFunction, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from './auth';

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: { message: 'Authorization required', code: 'NO_TOKEN' } });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, telegramId: true, isAdmin: true },
  });

  if (!user) {
    return res.status(401).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
  }

  const envAdminIds = env.adminTelegramIds;
  const isEnvAdmin = envAdminIds.includes(user.telegramId.toString());

  if (!user.isAdmin && !isEnvAdmin) {
    return res.status(403).json({ error: { message: 'Admin access required', code: 'ADMIN_ONLY' } });
  }

  next();
}
