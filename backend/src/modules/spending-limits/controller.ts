import { Request, Response } from 'express';
import { BadRequestError } from '../../shared/core/errors';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { spendingLimitService } from './service';

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export const getSpendingLimits = asyncHandler(async (req: Request, res: Response) => {
  const limits = await spendingLimitService.getUserLimits(req.userId!);
  res.json({ limits });
});

export const getSpendingLimit = asyncHandler(async (req: Request, res: Response) => {
  const limit = await spendingLimitService.getLimitById(req.userId!, getStringParam(req.params.id, 'Limit id'));
  res.json({ limit });
});

export const createSpendingLimit = asyncHandler(async (req: Request, res: Response) => {
  const limit = await spendingLimitService.createLimit(req.userId!, {
    targetType: req.body.targetType,
    accountId: req.body.accountId,
    categoryId: req.body.categoryId,
    amount: Number(req.body.amount),
    period: req.body.period,
    notifyAt: parseOptionalNumber(req.body.notifyAt),
    isActive: req.body.isActive,
  });

  res.status(201).json({ limit });
});

export const updateSpendingLimit = asyncHandler(async (req: Request, res: Response) => {
  const limit = await spendingLimitService.updateLimit(req.userId!, getStringParam(req.params.id, 'Limit id'), {
    targetType: req.body.targetType,
    accountId: req.body.accountId,
    categoryId: req.body.categoryId,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
    period: req.body.period,
    notifyAt: parseOptionalNumber(req.body.notifyAt),
    isActive: req.body.isActive,
  });

  res.json({ limit });
});

export const deleteSpendingLimit = asyncHandler(async (req: Request, res: Response) => {
  const limit = await spendingLimitService.deleteLimit(req.userId!, getStringParam(req.params.id, 'Limit id'));
  res.json({ limit });
});
