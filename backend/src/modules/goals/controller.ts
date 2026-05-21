import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { goalService } from './service';

function getId(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestError('Goal id is required');
  return value.trim();
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestError('Invalid amount');
  return parsed;
}

export const listGoals = asyncHandler(async (req: Request, res: Response) => {
  const goals = await goalService.list(req.userId!);
  res.json({ goals });
});

export const createGoal = asyncHandler(async (req: Request, res: Response) => {
  const goal = await goalService.create(req.userId!, {
    title: req.body.title,
    targetAmount: optionalNumber(req.body.targetAmount) ?? Number(req.body.targetAmount ?? 0),
    currentAmount: optionalNumber(req.body.currentAmount),
    currency: req.body.currency,
    accountId: req.body.accountId,
    note: req.body.note,
  });
  res.status(201).json({ goal });
});

export const updateGoal = asyncHandler(async (req: Request, res: Response) => {
  const goal = await goalService.update(req.userId!, getId(req.params.id), {
    title: req.body.title,
    targetAmount: optionalNumber(req.body.targetAmount),
    currentAmount: optionalNumber(req.body.currentAmount),
    currency: req.body.currency,
    accountId: req.body.accountId,
    status: req.body.status,
    note: req.body.note,
  });
  res.json({ goal });
});

export const deleteGoal = asyncHandler(async (req: Request, res: Response) => {
  const goal = await goalService.delete(req.userId!, getId(req.params.id));
  res.json({ goal });
});
