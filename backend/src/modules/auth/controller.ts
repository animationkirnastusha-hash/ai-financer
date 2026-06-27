import { Request, Response } from 'express';

import { AuthService } from './service';
import { telegramBotService } from '../telegram-bot/service';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { BadRequestError, UnauthorizedError } from '../../shared/core/errors';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  parseTelegramInitData,
  verifyTelegramWebAppData,
} from '../../shared/utils/telegramAuth';

const authService = new AuthService();

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { initData, fallbackDeviceId } = req.body as { initData?: string; fallbackDeviceId?: string };
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
   * Temporary no-initData fallback for unofficial Telegram clients.
   * Official Telegram initData login above is still preferred and unchanged.
   */
  const fallbackUser = await authService.findOrCreateFallbackDeviceUser(fallbackDeviceId);

  if (fallbackUser) {
    const token = authService.generateToken(fallbackUser.id);

    return res.json({
      user: authService.serializeUser(fallbackUser),
      token,
      mode: 'telegram_no_initdata',
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

  const userWithLocale = await authService.hydrateUserLocale(user);

  res.json({
    user: authService.serializeUser(userWithLocale),
  });
});

export const updateLocale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw new UnauthorizedError();
  }

  const user = await authService.updateUserLocale(req.userId, req.body?.locale);

  if (!user) {
    throw new BadRequestError('Unsupported locale');
  }

  res.json({
    user: authService.serializeUser(user),
  });
});

export const getFallbackInfo = asyncHandler(async (_req: Request, res: Response) => {
  res.json(authService.getFallbackInfo());
});

export const verifyFallbackCode = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.verifyFallbackLoginCode(req.body?.code);

  if (!user) {
    throw new UnauthorizedError('Код входа неверный или уже истёк');
  }

  const token = authService.generateToken(user.id);

  res.json({
    user: authService.serializeUser(user),
    token,
    mode: 'telegram_fallback',
  });
});

export const telegramFallbackWebhook = asyncHandler(async (req: Request, res: Response) => {
  const expectedSecret = process.env.TELEGRAM_FALLBACK_WEBHOOK_SECRET?.trim();

  if (expectedSecret) {
    const actualSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '');
    if (actualSecret !== expectedSecret) {
      throw new UnauthorizedError('Invalid Telegram webhook secret');
    }
  }

  const result = await telegramBotService.handleUpdate(req.body ?? {});

  res.json({ success: true, ...result });
});
