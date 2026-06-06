import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { subscriptionService } from './service';

function requireUserId(req: Request) {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

export const getMySubscription = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json(await subscriptionService.getStatus(userId));
});

export const startMyTrial = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json(await subscriptionService.startTrial(userId));
});


export const getMyFeatureAccess = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const feature = typeof req.params.feature === 'string' ? req.params.feature : '';
  if (!feature.trim()) throw new BadRequestError('Feature is required');
  res.json(await subscriptionService.getFeatureAccess(userId, feature.trim()));
});
