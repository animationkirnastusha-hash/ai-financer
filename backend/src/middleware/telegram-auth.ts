import { Request, Response, NextFunction } from 'express';
import {
  verifyTelegramWebAppData,
  parseTelegramInitData,
  TelegramUser,
} from '../shared/utils/telegramAuth';

export interface TelegramAuthRequest extends Request {
  telegramUser?: TelegramUser;
}

export function verifyTelegramAuth(
  req: TelegramAuthRequest,
  res: Response,
  next: NextFunction
) {
  const { initData } = req.body;

  if (process.env.NODE_ENV === 'development' && !initData) {
    req.telegramUser = {
      id: 516730814,
      first_name: 'Test',
      last_name: 'User',
      username: 'test_user',
    };
    return next();
  }

  if (!initData) {
    return res.status(401).json({
      error: {
        message: 'Missing Telegram initData',
        code: 'MISSING_TELEGRAM_INIT_DATA',
      },
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      error: {
        message: 'TELEGRAM_BOT_TOKEN is not configured',
        code: 'TELEGRAM_BOT_TOKEN_MISSING',
      },
    });
  }

  const isValid = verifyTelegramWebAppData(initData, botToken);

  if (!isValid) {
    return res.status(401).json({
      error: {
        message: 'Invalid Telegram hash',
        code: 'INVALID_TELEGRAM_HASH',
      },
    });
  }

  const user = parseTelegramInitData(initData);

  if (!user) {
    return res.status(401).json({
      error: {
        message: 'Invalid Telegram user data',
        code: 'INVALID_TELEGRAM_USER',
      },
    });
  }

  req.telegramUser = user;
  next();
}