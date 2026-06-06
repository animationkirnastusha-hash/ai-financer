import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { paymentService } from './service';

function requireUserId(req: Request) {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
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
