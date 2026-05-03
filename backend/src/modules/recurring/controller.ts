import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { RecurringService } from './service';

const recurringService = new RecurringService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function parseOptionalDate(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid date: ${String(value)}`);
  }

  return parsed;
}

export const getRecurringPayments = asyncHandler(async (req: Request, res: Response) => {
  const recurringPayments = await recurringService.getRecurringPayments(req.userId!);
  res.json({ recurringPayments });
});

export const getRecurringPayment = asyncHandler(async (req: Request, res: Response) => {
  const recurringId = getStringParam(req.params.id, 'Recurring payment id');
  const recurringPayment = await recurringService.getRecurringPaymentById(req.userId!, recurringId);

  res.json({ recurringPayment });
});

export const createRecurringPayment = asyncHandler(async (req: Request, res: Response) => {
  const recurringPayment = await recurringService.createRecurringPayment(req.userId!, {
    name: req.body.name,
    amount: Number(req.body.amount),
    category: req.body.category,
    period: req.body.period,
    accountId: req.body.accountId,
    nextDate: parseOptionalDate(req.body.nextDate),
    isActive: req.body.isActive,
  });

  res.status(201).json({
    message: 'Recurring payment created successfully',
    recurringPayment,
  });
});

export const updateRecurringPayment = asyncHandler(async (req: Request, res: Response) => {
  const recurringId = getStringParam(req.params.id, 'Recurring payment id');

  const recurringPayment = await recurringService.updateRecurringPayment(req.userId!, recurringId, {
    name: req.body.name,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
    category: req.body.category,
    period: req.body.period,
    accountId: req.body.accountId,
    nextDate: parseOptionalDate(req.body.nextDate),
    isActive: req.body.isActive,
  });

  res.json({
    message: 'Recurring payment updated successfully',
    recurringPayment,
  });
});

export const deleteRecurringPayment = asyncHandler(async (req: Request, res: Response) => {
  const recurringId = getStringParam(req.params.id, 'Recurring payment id');
  const recurringPayment = await recurringService.deleteRecurringPayment(req.userId!, recurringId);

  res.json({
    message: 'Recurring payment deleted successfully',
    recurringPayment,
  });
});