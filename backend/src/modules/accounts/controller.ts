import { Request, Response } from 'express';
import { AccountService } from './service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';

const accountService = new AccountService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadRequestError(`Invalid number: ${String(value)}`);
  }

  return parsed;
}

export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
  const accounts = await accountService.getUserAccounts(req.userId!);
  res.json({ accounts });
});

export const getAccount = asyncHandler(async (req: Request, res: Response) => {
  const accountId = getStringParam(req.params.id, 'Account id');
  const account = await accountService.getAccountById(req.userId!, accountId);

  res.json({ account });
});

export const createAccount = asyncHandler(async (req: Request, res: Response) => {
  const account = await accountService.createAccount(req.userId!, {
    name: req.body.name,
    type: req.body.type,
    currency: req.body.currency,
    balance: parseOptionalNumber(req.body.balance),
    showInTotalBalance: req.body.showInTotalBalance,
    lockRename: req.body.lockRename,
    lockSpending: req.body.lockSpending,
    lockTransfers: req.body.lockTransfers,
    lockBalance: req.body.lockBalance,
    lockVisibility: req.body.lockVisibility,
    icon: req.body.icon,
    color: req.body.color,
  });

  res.status(201).json({
    message: 'Account created successfully',
    account,
  });
});

export const updateAccount = asyncHandler(async (req: Request, res: Response) => {
  const accountId = getStringParam(req.params.id, 'Account id');

  const account = await accountService.updateAccount(req.userId!, accountId, {
    name: req.body.name,
    type: req.body.type,
    currency: req.body.currency,
    showInTotalBalance: req.body.showInTotalBalance,
    balance: parseOptionalNumber(req.body.balance),
    lockRename: req.body.lockRename,
    lockSpending: req.body.lockSpending,
    lockTransfers: req.body.lockTransfers,
    lockBalance: req.body.lockBalance,
    lockVisibility: req.body.lockVisibility,
    icon: req.body.icon,
    color: req.body.color,
  });

  res.json({
    message: 'Account updated successfully',
    account,
  });
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const accountId = getStringParam(req.params.id, 'Account id');
  const account = await accountService.deleteAccount(req.userId!, accountId);

  res.json({
    message: 'Account deleted successfully',
    account,
  });
});

export const getTotalBalance = asyncHandler(async (req: Request, res: Response) => {
  const balance = await accountService.getTotalBalance(req.userId!);

  res.json({ balance });
});

export const getAccountsSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await accountService.getAccountsSummary(req.userId!);

  res.json(summary);
});

export const recalculateAllBalances = asyncHandler(async (req: Request, res: Response) => {
  const accounts = await accountService.recalculateAllBalances(req.userId!);

  res.json({
    message: 'Balances recalculated successfully',
    accounts,
  });
});
