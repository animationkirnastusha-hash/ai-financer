import { Request, Response } from 'express';

import { AuthService } from './service';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { UnauthorizedError } from '../../shared/core/errors';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  parseTelegramInitData,
  verifyTelegramWebAppData,
} from '../../shared/utils/telegramAuth';

const authService = new AuthService();

export const login = asyncHandler(async (req: Request, res: Response) => {
 const { initData } = req.body as { initData?: string };
  console.log('[AUTH] initData exists:', Boolean(initData));
console.log('[AUTH] initData length:', initData?.length ?? 0);
  /**
   * REAL TELEGRAM LOGIN
   */
  if (initData && initData.length > 20) {
    if (!env.telegramBotToken) {
      throw new UnauthorizedError('TELEGRAM_BOT_TOKEN is not configured');
    }

    const isValid = verifyTelegramWebAppData(initData, env.telegramBotToken);

    if (!isValid) {
      throw new UnauthorizedError('Invalid Telegram initData');
    }

    const telegramUser = parseTelegramInitData(initData);
console.log('[AUTH] telegram user:', telegramUser);
    if (!telegramUser) {
      throw new UnauthorizedError('Telegram user is missing');
    }

    const user = await authService.findOrCreateUser(telegramUser);
    const token = authService.generateToken(user.id);

    return res.json({
      user: authService.serializeUser(user),
      token,
      mode: 'telegram',
    });
  }

  /**
   * DEV LOGIN ONLY OUTSIDE TELEGRAM
   */
  if (env.isDevelopment) {
    const devTelegramId = Number(process.env.DEV_TELEGRAM_ID || 1001);

    const user = await authService.findOrCreateUser({
      id: devTelegramId,
      first_name:
        String(devTelegramId) === String(env.adminTelegramId) ? 'Admin' : 'Dev',
      last_name: 'User',
      username:
        String(devTelegramId) === String(env.adminTelegramId)
          ? 'admin'
          : `dev_${devTelegramId}`,
    });

    const token = authService.generateToken(user.id);

    return res.json({
      user: authService.serializeUser(user),
      token,
      mode: 'development',
    });
  }

  throw new UnauthorizedError('Telegram initData is required');
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: {
      id: req.userId,
    },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  res.json({
    user: authService.serializeUser(user),
  });
});