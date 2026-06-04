import { Request, Response } from 'express';
import { obligationService } from './service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';

function getStringParam(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestError(`${label} is required`);
  return value;
}

function parseDate(value: unknown) {
  if (!value) return undefined;
  if (typeof value !== 'string') throw new BadRequestError('Invalid date');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date');
  return date;
}

function parseNullableDate(value: unknown) {
  if (value === null) return null;
  return parseDate(value);
}

function normalizeLoanBody(body: Record<string, unknown>) {
  return {
    title: body.title as string,
    type: body.type as never,
    creditor: body.creditor as string | null | undefined,
    currency: body.currency as string | undefined,
    principalAmount: body.principalAmount !== undefined ? Number(body.principalAmount) : undefined,
    currentDebt: body.currentDebt !== undefined ? Number(body.currentDebt) : undefined,
    monthlyPayment: body.monthlyPayment !== undefined ? Number(body.monthlyPayment) : undefined,
    interestRate: body.interestRate === null || body.interestRate === undefined || body.interestRate === '' ? null : Number(body.interestRate),
    termMonths: body.termMonths === null || body.termMonths === undefined || body.termMonths === '' ? null : Number(body.termMonths),
    paidMonths: body.paidMonths !== undefined ? Number(body.paidMonths) : undefined,
    paymentDay: body.paymentDay === null || body.paymentDay === undefined || body.paymentDay === '' ? null : Number(body.paymentDay),
    nextPaymentDate: parseNullableDate(body.nextPaymentDate),
    reminderDaysBefore: body.reminderDaysBefore !== undefined ? Number(body.reminderDaysBefore) : undefined,
    accountId: body.accountId as string | null | undefined,
    autoCreateExpense: body.autoCreateExpense !== undefined ? Boolean(body.autoCreateExpense) : undefined,
    status: body.status as never,
    note: body.note as string | null | undefined,
  };
}

export const getObligationSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await obligationService.getSummary(req.userId!);
  res.json({ summary });
});

export const getLoans = asyncHandler(async (req: Request, res: Response) => {
  const loans = await obligationService.listLoans(req.userId!);
  res.json({ loans });
});

export const getLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await obligationService.getLoan(req.userId!, getStringParam(req.params.id, 'Loan id'));
  res.json({ loan });
});

export const createLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await obligationService.createLoan(req.userId!, normalizeLoanBody(req.body ?? {}));
  res.status(201).json({ loan });
});

export const updateLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await obligationService.updateLoan(req.userId!, getStringParam(req.params.id, 'Loan id'), normalizeLoanBody(req.body ?? {}));
  res.json({ loan });
});

export const deleteLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await obligationService.deleteLoan(req.userId!, getStringParam(req.params.id, 'Loan id'));
  res.json({ loan });
});

export const markLoanPaid = asyncHandler(async (req: Request, res: Response) => {
  const result = await obligationService.markLoanPaid(req.userId!, getStringParam(req.params.id, 'Loan id'), {
    amount: req.body?.amount !== undefined ? Number(req.body.amount) : undefined,
    accountId: req.body?.accountId ?? undefined,
    paidAt: parseDate(req.body?.paidAt),
    createExpense: req.body?.createExpense !== undefined ? Boolean(req.body.createExpense) : undefined,
    note: req.body?.note,
  });
  res.json(result);
});

export const getReminders = asyncHandler(async (req: Request, res: Response) => {
  const reminders = await obligationService.listReminders(req.userId!);
  res.json({ reminders });
});

export const createReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await obligationService.createReminder(req.userId!, {
    loanId: req.body?.loanId ?? null,
    title: req.body?.title,
    message: req.body?.message ?? null,
    dueDate: parseDate(req.body?.dueDate) ?? new Date(),
    remindAt: parseDate(req.body?.remindAt) ?? null,
    channel: req.body?.channel,
  });
  res.status(201).json({ reminder });
});

export const updateReminderStatus = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await obligationService.updateReminderStatus(
    req.userId!,
    getStringParam(req.params.id, 'Reminder id'),
    String(req.body?.status || 'scheduled'),
  );
  res.json({ reminder });
});
