import { Request, Response } from 'express';
import { TransactionService, TransactionType } from './service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';

const transactionService = new TransactionService();

function parseOptionalDate(value: unknown) {
  if (!value || typeof value !== 'string') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid date: ${value}`);
  }

  return parsed;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadRequestError(`Invalid number: ${String(value)}`);
  }

  return parsed;
}

function parseOptionalType(value: unknown): TransactionType | undefined {
  if (!value) return undefined;

  if (value !== 'income' && value !== 'expense' && value !== 'transfer') {
    throw new BadRequestError('Invalid transaction type');
  }

  return value;
}

function getStringParam(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await transactionService.getUserTransactions(req.userId!, {
    accountId: typeof req.query.accountId === 'string' ? req.query.accountId : undefined,
    categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
    sectionId: typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined,
    type: parseOptionalType(req.query.type),
    startDate: parseOptionalDate(req.query.startDate),
    endDate: parseOptionalDate(req.query.endDate),
    limit: parseOptionalNumber(req.query.limit),
    offset: parseOptionalNumber(req.query.offset),
  });

  res.json(transactions);
});

export const getLatestTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await transactionService.getLatestTransaction(req.userId!);

  res.json({ transaction });
});

export const getTransactionStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await transactionService.getMonthlyStats(req.userId!, {
    startDate: parseOptionalDate(req.query.startDate),
    endDate: parseOptionalDate(req.query.endDate),
  });

  res.json(stats);
});

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getStringParam(req.params.id, 'Transaction id');
  const transaction = await transactionService.getTransactionById(req.userId!, transactionId);

  res.json(transaction);
});

export const createTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await transactionService.createTransaction(req.userId!, {
    accountId: req.body.accountId,
    toAccountId: req.body.toAccountId,
    categoryId: req.body.categoryId,
    sectionId: req.body.sectionId,
    amount: Number(req.body.amount),
    type: req.body.type,
    title: req.body.title,
    description: req.body.description,
    date: req.body.date ? new Date(req.body.date) : undefined,
    isAIGenerated: Boolean(req.body.isAIGenerated),
  });

  res.status(201).json({
    message: 'Transaction created successfully',
    transaction,
  });
});

export const updateTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getStringParam(req.params.id, 'Transaction id');

  const transaction = await transactionService.updateTransaction(req.userId!, transactionId, {
    accountId: req.body.accountId,
    toAccountId: req.body.toAccountId,
    categoryId: req.body.categoryId,
    sectionId: req.body.sectionId,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
    type: req.body.type,
    title: req.body.title,
    description: req.body.description,
    date: req.body.date ? new Date(req.body.date) : undefined,
  });

  res.json({
    message: 'Transaction updated successfully',
    transaction,
  });
});

export const deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getStringParam(req.params.id, 'Transaction id');

  const transaction = await transactionService.deleteTransaction(req.userId!, transactionId);

  res.json({
    message: 'Transaction deleted successfully',
    transaction,
  });
});
