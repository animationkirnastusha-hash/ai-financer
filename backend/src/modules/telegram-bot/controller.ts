import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { UnauthorizedError } from '../../shared/core/errors';
import { telegramBotService } from './service';

function getWebhookSecret() {
  return (
    process.env.TELEGRAM_BOT_WEBHOOK_SECRET?.trim()
    || process.env.TELEGRAM_FALLBACK_WEBHOOK_SECRET?.trim()
    || ''
  );
}

function assertTelegramWebhook(req: Request) {
  const expected = getWebhookSecret();
  if (!expected) throw new UnauthorizedError('Telegram bot webhook is not configured');

  const received = String(req.header('x-telegram-bot-api-secret-token') || '');
  if (received !== expected) throw new UnauthorizedError('Invalid Telegram webhook secret');
}

export const telegramBotWebhook = asyncHandler(async (req: Request, res: Response) => {
  assertTelegramWebhook(req);
  const result = await telegramBotService.handleUpdate(req.body ?? {});
  res.json({ success: true, ...result });
});
