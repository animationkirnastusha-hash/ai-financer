import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ReferralService } from './service';

const referralService = new ReferralService();

export const getReferralInfo = asyncHandler(async (req: Request, res: Response) => {
  const referral = await referralService.getReferralInfo(req.userId!);

  res.json({ referral });
});

export const applyReferralCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  const referral = await referralService.applyReferralCode(req.userId!, code ?? '');

  res.json({ referral });
});
