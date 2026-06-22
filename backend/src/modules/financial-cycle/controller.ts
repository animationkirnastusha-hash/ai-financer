import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { financialCycleService } from './service';

function currentUserId(req: Request) {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

export const getFinancialCycle = asyncHandler(async (req: Request, res: Response) => {
  const financialCycle = await financialCycleService.get(currentUserId(req));
  res.json({ financialCycle });
});

export const updateFinancialCycle = asyncHandler(async (req: Request, res: Response) => {
  const financialCycle = await financialCycleService.update(currentUserId(req), req.body ?? {});
  res.json({ financialCycle });
});
