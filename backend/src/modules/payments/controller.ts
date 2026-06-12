import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError, UnauthorizedError } from '../../shared/core/errors';
import { env } from '../../config/env';
import { paymentService } from './service';

function requireUserId(req: Request) {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

function getWebhookSecret() {
  return env.telegramPaymentsWebhookSecret.trim();
}

function assertTelegramWebhook(req: Request) {
  const expected = getWebhookSecret();
  if (!expected) throw new UnauthorizedError('Telegram payment webhook is not configured');

  const received = String(req.header('x-telegram-bot-api-secret-token') || '');
  if (received !== expected) throw new UnauthorizedError('Invalid Telegram webhook secret');
}

export const getPaymentCatalog = asyncHandler(async (_req: Request, res: Response) => {
  res.json(paymentService.getCatalog());
});

export const createPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json(await paymentService.createCheckout(userId, req.body ?? {}));
});

export const getPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  if (!orderId.trim()) throw new BadRequestError('Order is required');
  res.json(await paymentService.getOrder(userId, orderId));
});

export const completeMockPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  if (!orderId.trim()) throw new BadRequestError('Order is required');
  res.json(await paymentService.completeMockOrder(userId, orderId));
});

export const telegramPaymentsWebhook = asyncHandler(async (req: Request, res: Response) => {
  assertTelegramWebhook(req);
  res.json(await paymentService.handleTelegramUpdate(req.body ?? {}));
});
