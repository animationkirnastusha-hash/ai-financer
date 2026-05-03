import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { BudgetService } from './service';

const budgetService = new BudgetService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function parseOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }

  return parsed;
}

export const getBudgets = asyncHandler(async (req: Request, res: Response) => {
  const budgets = await budgetService.getUserBudgets(req.userId!);
  res.json({ budgets });
});

export const getBudget = asyncHandler(async (req: Request, res: Response) => {
  const budgetId = getStringParam(req.params.id, 'Budget id');
  const budget = await budgetService.getBudgetById(req.userId!, budgetId);

  res.json({ budget });
});

export const createBudget = asyncHandler(async (req: Request, res: Response) => {
  const budget = await budgetService.createBudget(req.userId!, {
    categoryId: req.body.categoryId,
    amount: Number(req.body.amount),
    period: req.body.period,
    notifyAt: parseOptionalNumber(req.body.notifyAt, 'notifyAt'),
    isActive: req.body.isActive,
  });

  res.status(201).json({
    message: 'Budget created successfully',
    budget,
  });
});

export const updateBudget = asyncHandler(async (req: Request, res: Response) => {
  const budgetId = getStringParam(req.params.id, 'Budget id');

  const budget = await budgetService.updateBudget(req.userId!, budgetId, {
    categoryId: req.body.categoryId,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
    period: req.body.period,
    notifyAt: parseOptionalNumber(req.body.notifyAt, 'notifyAt'),
    isActive: req.body.isActive,
  });

  res.json({
    message: 'Budget updated successfully',
    budget,
  });
});

export const deleteBudget = asyncHandler(async (req: Request, res: Response) => {
  const budgetId = getStringParam(req.params.id, 'Budget id');
  const budget = await budgetService.deleteBudget(req.userId!, budgetId);

  res.json({
    message: 'Budget deleted successfully',
    budget,
  });
});