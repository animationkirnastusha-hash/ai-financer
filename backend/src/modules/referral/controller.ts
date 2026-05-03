import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ReferralService } from './service';

const referralService = new ReferralService();

export const getReferralInfo = asyncHandler(async (req: Request, res: Response) => {
  const referral = await referralService.getReferralInfo(req.userId!);

  res.json({ referral });
});