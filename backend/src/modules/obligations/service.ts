import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { TransactionService } from '../transactions/service';

export type LoanType = 'loan' | 'mortgage' | 'installment' | 'subscription' | 'other';
export type LoanStatus = 'active' | 'paused' | 'closed';

export type CreateLoanInput = {
  title: string;
  type?: LoanType;
  creditor?: string | null;
  currency?: string;
  principalAmount?: number;
  currentDebt?: number;
  monthlyPayment?: number;
  interestRate?: number | null;
  termMonths?: number | null;
  paidMonths?: number;
  paymentDay?: number | null;
  nextPaymentDate?: Date | null;
  reminderDaysBefore?: number;
  accountId?: string | null;
  autoCreateExpense?: boolean;
  note?: string | null;
};

export type UpdateLoanInput = Partial<CreateLoanInput> & {
  status?: LoanStatus;
};

export type CreateReminderInput = {
  loanId?: string | null;
  title: string;
  message?: string | null;
  dueDate: Date;
  remindAt?: Date | null;
  channel?: string;
};

export type MarkLoanPaymentInput = {
  amount?: number;
  accountId?: string | null;
  paidAt?: Date;
  createExpense?: boolean;
  note?: string | null;
};

const loanInclude = {
  account: {
    select: {
      id: true,
      name: true,
      currency: true,
      icon: true,
      color: true,
    },
  },
  payments: {
    orderBy: { paidAt: 'desc' },
    take: 5,
  },
  reminders: {
    where: { status: { in: ['scheduled', 'sent'] } },
    orderBy: { remindAt: 'asc' },
    take: 3,
  },
} satisfies Prisma.LoanInclude;

type LoanWithIncludes = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;

function normalizeMoney(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new BadRequestError('Amount must be a positive number');
  }
  return numeric;
}

function normalizeText(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestError(`${label} is required`);
  return text;
}

function normalizeOptionalText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeLoanType(value: unknown): LoanType {
  if (value === 'mortgage' || value === 'installment' || value === 'subscription' || value === 'other') return value;
  return 'loan';
}

function normalizeStatus(value: unknown): LoanStatus {
  if (value === 'paused' || value === 'closed') return value;
  return 'active';
}

function normalizePaymentDay(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const day = Math.round(Number(value));
  if (!Number.isFinite(day) || day < 1 || day > 31) throw new BadRequestError('Payment day must be between 1 and 31');
  return day;
}

function normalizeReminderDays(value: unknown) {
  if (value === undefined || value === null || value === '') return 1;
  const days = Math.round(Number(value));
  if (!Number.isFinite(days) || days < 0 || days > 30) throw new BadRequestError('Reminder days must be between 0 and 30');
  return days;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function getNextMonthlyDate(paymentDay?: number | null, from = new Date()) {
  if (!paymentDay) return null;
  const day = Math.min(paymentDay, 28);
  const next = new Date(from.getFullYear(), from.getMonth(), day, 9, 0, 0, 0);
  if (next.getTime() < from.getTime()) next.setMonth(next.getMonth() + 1);
  return next;
}

function getReminderDate(dueDate: Date, daysBefore: number) {
  const remindAt = new Date(dueDate);
  remindAt.setDate(remindAt.getDate() - daysBefore);
  remindAt.setHours(9, 0, 0, 0);
  return remindAt;
}

export class ObligationService {
  private transactionService = new TransactionService();

  async getSummary(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [loans, upcomingReminders] = await Promise.all([
      prisma.loan.findMany({
        where: { userId, status: 'active' },
        include: loanInclude,
        orderBy: [{ nextPaymentDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.obligationReminder.findMany({
        where: {
          userId,
          status: 'scheduled',
          remindAt: { lte: monthEnd },
        },
        include: { loan: { select: { id: true, title: true, type: true, monthlyPayment: true, currency: true, accountId: true } } },
        orderBy: { remindAt: 'asc' },
        take: 10,
      }),
    ]);

    const monthlyPaymentTotal = loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
    const totalDebt = loans.reduce((sum, loan) => sum + loan.currentDebt, 0);
    const dueThisMonth = loans.filter((loan) => loan.nextPaymentDate && loan.nextPaymentDate >= monthStart && loan.nextPaymentDate <= monthEnd);
    const nearestLoan = loans.find((loan) => loan.nextPaymentDate) ?? loans[0] ?? null;

    return {
      loans: loans.map((loan) => this.serializeLoan(loan)),
      activeLoansCount: loans.length,
      monthlyPaymentTotal,
      totalDebt,
      dueThisMonthCount: dueThisMonth.length,
      nearest: nearestLoan ? this.serializeLoan(nearestLoan) : null,
      upcomingReminders,
    };
  }

  async listLoans(userId: string) {
    const loans = await prisma.loan.findMany({
      where: { userId },
      include: loanInclude,
      orderBy: [{ status: 'asc' }, { nextPaymentDate: 'asc' }, { createdAt: 'desc' }],
    });

    return loans.map((loan) => this.serializeLoan(loan));
  }

  async getLoan(userId: string, loanId: string) {
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId }, include: loanInclude });
    if (!loan) throw new NotFoundError('Loan not found');
    return this.serializeLoan(loan);
  }

  async createLoan(userId: string, input: CreateLoanInput) {
    const title = normalizeText(input.title, 'Loan title');
    const paymentDay = normalizePaymentDay(input.paymentDay);
    const reminderDaysBefore = normalizeReminderDays(input.reminderDaysBefore);
    const monthlyPayment = normalizeMoney(input.monthlyPayment, 0);
    const principalAmount = normalizeMoney(input.principalAmount, 0);
    const currentDebt = normalizeMoney(input.currentDebt, principalAmount);
    const nextPaymentDate = input.nextPaymentDate ?? getNextMonthlyDate(paymentDay);

    if (input.accountId) await this.ensureOwnedAccount(userId, input.accountId);

    const loan = await prisma.loan.create({
      data: {
        userId,
        accountId: input.accountId ?? null,
        title,
        type: normalizeLoanType(input.type),
        creditor: normalizeOptionalText(input.creditor),
        currency: input.currency || 'RUB',
        principalAmount,
        currentDebt,
        monthlyPayment,
        interestRate: input.interestRate === undefined || input.interestRate === null ? null : Number(input.interestRate),
        termMonths: input.termMonths === undefined || input.termMonths === null ? null : Math.max(1, Math.round(Number(input.termMonths))),
        paidMonths: Math.max(0, Math.round(Number(input.paidMonths ?? 0))),
        paymentDay,
        nextPaymentDate,
        reminderDaysBefore,
        autoCreateExpense: Boolean(input.autoCreateExpense),
        note: normalizeOptionalText(input.note),
        status: 'active',
      },
      include: loanInclude,
    });

    await this.rebuildLoanReminder(userId, loan.id);
    return this.getLoan(userId, loan.id);
  }

  async updateLoan(userId: string, loanId: string, input: UpdateLoanInput) {
    const existing = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!existing) throw new NotFoundError('Loan not found');

    if (input.accountId) await this.ensureOwnedAccount(userId, input.accountId);

    const data: Prisma.LoanUpdateInput = {};
    if (input.title !== undefined) data.title = normalizeText(input.title, 'Loan title');
    if (input.type !== undefined) data.type = normalizeLoanType(input.type);
    if (input.creditor !== undefined) data.creditor = normalizeOptionalText(input.creditor);
    if (input.currency !== undefined) data.currency = input.currency || existing.currency;
    if (input.principalAmount !== undefined) data.principalAmount = normalizeMoney(input.principalAmount, existing.principalAmount);
    if (input.currentDebt !== undefined) data.currentDebt = normalizeMoney(input.currentDebt, existing.currentDebt);
    if (input.monthlyPayment !== undefined) data.monthlyPayment = normalizeMoney(input.monthlyPayment, existing.monthlyPayment);
    if (input.interestRate !== undefined) data.interestRate = input.interestRate === null ? null : Number(input.interestRate);
    if (input.termMonths !== undefined) data.termMonths = input.termMonths === null ? null : Math.max(1, Math.round(Number(input.termMonths)));
    if (input.paidMonths !== undefined) data.paidMonths = Math.max(0, Math.round(Number(input.paidMonths)));
    if (input.paymentDay !== undefined) data.paymentDay = normalizePaymentDay(input.paymentDay);
    if (input.nextPaymentDate !== undefined) data.nextPaymentDate = input.nextPaymentDate;
    if (input.reminderDaysBefore !== undefined) data.reminderDaysBefore = normalizeReminderDays(input.reminderDaysBefore);
    if (input.accountId !== undefined) data.account = input.accountId ? { connect: { id: input.accountId } } : { disconnect: true };
    if (input.autoCreateExpense !== undefined) data.autoCreateExpense = Boolean(input.autoCreateExpense);
    if (input.status !== undefined) data.status = normalizeStatus(input.status);
    if (input.note !== undefined) data.note = normalizeOptionalText(input.note);

    const updated = await prisma.loan.update({ where: { id: loanId }, data, include: loanInclude });
    await this.rebuildLoanReminder(userId, updated.id);
    return this.getLoan(userId, updated.id);
  }

  async deleteLoan(userId: string, loanId: string) {
    const existing = await prisma.loan.findFirst({ where: { id: loanId, userId }, include: loanInclude });
    if (!existing) throw new NotFoundError('Loan not found');
    await prisma.loan.delete({ where: { id: loanId } });
    return this.serializeLoan(existing);
  }

  async markLoanPaid(userId: string, loanId: string, input: MarkLoanPaymentInput = {}) {
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) throw new NotFoundError('Loan not found');

    const amount = normalizeMoney(input.amount, loan.monthlyPayment || loan.currentDebt);
    if (amount <= 0) throw new BadRequestError('Payment amount is required');

    const accountId = input.accountId ?? loan.accountId;
    const shouldCreateExpense = input.createExpense ?? loan.autoCreateExpense;
    let transactionId: string | null = null;

    if (shouldCreateExpense) {
      if (!accountId) throw new BadRequestError('Account is required to create payment expense');
      const tx = await this.transactionService.createTransaction(userId, {
        accountId,
        amount,
        type: 'expense',
        title: `Платёж: ${loan.title}`,
        description: input.note?.trim() || `Платёж по обязательству ${loan.title}`,
        date: input.paidAt ?? new Date(),
        isAIGenerated: false,
      });
      transactionId = tx.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.loanPayment.create({
        data: {
          userId,
          loanId,
          accountId: accountId ?? null,
          amount,
          paidAt: input.paidAt ?? new Date(),
          transactionId,
          note: normalizeOptionalText(input.note),
        },
      });

      const nextDebt = Math.max(0, loan.currentDebt - amount);
      const nextDate = loan.nextPaymentDate ? addMonths(loan.nextPaymentDate, 1) : getNextMonthlyDate(loan.paymentDay);
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          currentDebt: nextDebt,
          paidMonths: { increment: 1 },
          nextPaymentDate: nextDebt > 0 ? nextDate : null,
          status: nextDebt > 0 ? loan.status : 'closed',
        },
      });

      await tx.obligationReminder.updateMany({
        where: { userId, loanId: loan.id, status: 'scheduled' },
        data: { status: 'done' },
      });
    });

    const updated = await this.getLoan(userId, loanId);
    await this.rebuildLoanReminder(userId, loanId);

    return { loan: updated, transactionId };
  }

  async listReminders(userId: string) {
    return prisma.obligationReminder.findMany({
      where: { userId, status: { not: 'cancelled' } },
      include: { loan: { select: { id: true, title: true, type: true, monthlyPayment: true, currency: true } } },
      orderBy: [{ remindAt: 'asc' }],
      take: 100,
    });
  }

  async createReminder(userId: string, input: CreateReminderInput) {
    if (input.loanId) {
      const loan = await prisma.loan.findFirst({ where: { id: input.loanId, userId }, select: { id: true } });
      if (!loan) throw new NotFoundError('Loan not found');
    }

    return prisma.obligationReminder.create({
      data: {
        userId,
        loanId: input.loanId ?? null,
        title: normalizeText(input.title, 'Reminder title'),
        message: input.message?.trim() || normalizeText(input.title, 'Reminder title'),
        dueDate: input.dueDate,
        remindAt: input.remindAt ?? input.dueDate,
        channel: input.channel || 'app',
        status: 'scheduled',
      },
    });
  }

  async updateReminderStatus(userId: string, reminderId: string, status: string) {
    const reminder = await prisma.obligationReminder.findFirst({ where: { id: reminderId, userId } });
    if (!reminder) throw new NotFoundError('Reminder not found');

    const nextStatus = ['scheduled', 'sent', 'done', 'cancelled'].includes(status) ? status : 'scheduled';
    return prisma.obligationReminder.update({ where: { id: reminderId }, data: { status: nextStatus } });
  }

  private async ensureOwnedAccount(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }

  private async rebuildLoanReminder(userId: string, loanId: string) {
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) return;

    await prisma.obligationReminder.updateMany({
      where: { userId, loanId, status: 'scheduled' },
      data: { status: 'cancelled' },
    });

    if (loan.status !== 'active' || !loan.nextPaymentDate || loan.monthlyPayment <= 0) return;

    const remindAt = getReminderDate(loan.nextPaymentDate, loan.reminderDaysBefore);
    await prisma.obligationReminder.create({
      data: {
        userId,
        loanId,
        title: `Платёж: ${loan.title}`,
        message: `Платёж ${loan.monthlyPayment} ${loan.currency} по обязательству «${loan.title}»`,
        dueDate: loan.nextPaymentDate,
        remindAt,
        channel: 'app',
        status: 'scheduled',
      },
    });
  }

  private serializeLoan(loan: LoanWithIncludes) {
    const progress = loan.principalAmount > 0
      ? Math.round(((loan.principalAmount - loan.currentDebt) / loan.principalAmount) * 100)
      : 0;

    return {
      ...loan,
      progress: Math.max(0, Math.min(100, progress)),
      daysUntilPayment: loan.nextPaymentDate
        ? Math.ceil((loan.nextPaymentDate.getTime() - Date.now()) / 86400000)
        : null,
    };
  }
}

export const obligationService = new ObligationService();
