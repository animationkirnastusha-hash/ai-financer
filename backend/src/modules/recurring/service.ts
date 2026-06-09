import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type RecurringPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface CreateRecurringPaymentInput {
  name: string;
  amount: number;
  category?: string | null;
  period: string;
  accountId: string;
  nextDate?: Date;
  isActive?: boolean;
}

export interface UpdateRecurringPaymentInput {
  name?: string;
  amount?: number;
  category?: string | null;
  period?: string;
  accountId?: string;
  nextDate?: Date;
  isActive?: boolean;
}

export interface MarkRecurringPaidInput {
  paidAt?: Date;
  advance?: boolean;
}

const recurringInclude = {
  account: {
    select: {
      id: true,
      name: true,
      currency: true,
      balance: true,
      icon: true,
      color: true,
    },
  },
} satisfies Prisma.RecurringPaymentInclude;

function normalizeText(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestError(`${label} is required`);
  return text;
}

function normalizeOptionalText(value: unknown, fallback = 'Регулярный платёж') {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeAmount(value: unknown) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('amount must be greater than 0');
  return amount;
}

function normalizePeriod(value: unknown): RecurringPeriod {
  if (value === 'weekly' || value === 'yearly' || value === 'custom') return value;
  return 'monthly';
}

function addPeriod(date: Date, period: string) {
  const next = new Date(date);
  if (period === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (period === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

function serializeRecurring(payment: Prisma.RecurringPaymentGetPayload<{ include: typeof recurringInclude }>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(payment.nextDate);
  due.setHours(0, 0, 0, 0);

  return {
    ...payment,
    daysUntilPayment: Math.round((due.getTime() - today.getTime()) / 86400000),
  };
}

export class RecurringService {
  async getRecurringPayments(userId: string) {
    const rows = await prisma.recurringPayment.findMany({
      where: { userId },
      include: recurringInclude,
      orderBy: [{ isActive: 'desc' }, { nextDate: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map(serializeRecurring);
  }

  async getActiveUpcoming(userId: string, take = 12) {
    const rows = await prisma.recurringPayment.findMany({
      where: { userId, isActive: true },
      include: recurringInclude,
      orderBy: [{ nextDate: 'asc' }, { createdAt: 'desc' }],
      take,
    });

    return rows.map(serializeRecurring);
  }

  async getRecurringPaymentById(userId: string, recurringId: string) {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
      include: recurringInclude,
    });

    if (!recurringPayment) throw new NotFoundError('Recurring payment not found');
    return serializeRecurring(recurringPayment);
  }

  async createRecurringPayment(userId: string, input: CreateRecurringPaymentInput) {
    const name = normalizeText(input.name, 'name');
    const amount = normalizeAmount(input.amount);
    const period = normalizePeriod(input.period);
    const account = await this.ensureAccount(userId, input.accountId);

    const recurringPayment = await prisma.recurringPayment.create({
      data: {
        userId,
        accountId: account.id,
        name,
        amount,
        category: normalizeOptionalText(input.category),
        period,
        nextDate: input.nextDate ?? new Date(),
        isActive: input.isActive ?? true,
      },
      include: recurringInclude,
    });

    return serializeRecurring(recurringPayment);
  }

  async updateRecurringPayment(userId: string, recurringId: string, input: UpdateRecurringPaymentInput) {
    const existing = await prisma.recurringPayment.findFirst({ where: { id: recurringId, userId } });
    if (!existing) throw new NotFoundError('Recurring payment not found');

    let accountId = input.accountId;
    if (accountId !== undefined) {
      const account = await this.ensureAccount(userId, accountId);
      accountId = account.id;
    }

    const recurringPayment = await prisma.recurringPayment.update({
      where: { id: recurringId },
      data: {
        ...(input.name !== undefined ? { name: normalizeText(input.name, 'name') } : {}),
        ...(input.amount !== undefined ? { amount: normalizeAmount(input.amount) } : {}),
        ...(input.category !== undefined ? { category: normalizeOptionalText(input.category) } : {}),
        ...(input.period !== undefined ? { period: normalizePeriod(input.period) } : {}),
        ...(accountId !== undefined ? { accountId } : {}),
        ...(input.nextDate !== undefined ? { nextDate: input.nextDate } : {}),
        ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      },
      include: recurringInclude,
    });

    return serializeRecurring(recurringPayment);
  }

  async markPaid(userId: string, recurringId: string, input: MarkRecurringPaidInput = {}) {
    const existing = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
      include: recurringInclude,
    });
    if (!existing) throw new NotFoundError('Recurring payment not found');

    const nextDate = input.advance === false ? existing.nextDate : addPeriod(input.paidAt ?? existing.nextDate, existing.period);
    const updated = await prisma.recurringPayment.update({
      where: { id: recurringId },
      data: { nextDate },
      include: recurringInclude,
    });

    return serializeRecurring(updated);
  }

  async deleteRecurringPayment(userId: string, recurringId: string) {
    const existing = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
      include: recurringInclude,
    });

    if (!existing) throw new NotFoundError('Recurring payment not found');

    await prisma.recurringPayment.delete({ where: { id: recurringId } });
    return serializeRecurring(existing);
  }

  private async ensureAccount(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }
}

export const recurringService = new RecurringService();
