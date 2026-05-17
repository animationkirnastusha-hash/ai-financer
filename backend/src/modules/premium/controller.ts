import { Request, Response } from 'express';
import { BadRequestError } from '../../shared/core/errors';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { aiPremiumService } from '../ai/ai-premium.service';

export const getPremiumCapabilities = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const result = await aiPremiumService.getCapabilities(userId);
  res.json(result);
});
