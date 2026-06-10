import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { TransactionService } from '../transactions/service';

export type RecurringPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface CreateRecurringPaymentInput {
  name: string;
  amount: number;
  category?: string | null;
  categoryId?: string | null;
  sectionId?: string | null;
  period: string;
  accountId: string;
  nextDate?: Date;
  isActive?: boolean;
}

export interface UpdateRecurringPaymentInput {
  name?: string;
  amount?: number;
  category?: string | null;
  categoryId?: string | null;
  sectionId?: string | null;
  period?: string;
  accountId?: string;
  nextDate?: Date;
  isActive?: boolean;
}

export interface MarkRecurringPaidInput {
  paidAt?: Date;
  advance?: boolean;
  createExpense?: boolean;
  note?: string | null;
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
  categoryRef: {
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
      sectionId: true,
    },
  },
  section: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  },
  payments: {
    orderBy: { paidAt: 'desc' },
    take: 5,
    include: {
      transaction: {
        select: { id: true, amount: true, title: true, date: true, type: true },
      },
    },
  },
} satisfies Prisma.RecurringPaymentInclude;

type RecurringWithInclude = Prisma.RecurringPaymentGetPayload<{ include: typeof recurringInclude }>;

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

function normalizeNullableText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
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

function serializeRecurring(payment: RecurringWithInclude) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(payment.nextDate);
  due.setHours(0, 0, 0, 0);

  return {
    ...payment,
    category: payment.categoryRef?.name ?? payment.category,
    daysUntilPayment: Math.round((due.getTime() - today.getTime()) / 86400000),
  };
}

export class RecurringService {
  private transactionService = new TransactionService();

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
    const taxonomy = await this.resolveTaxonomy(userId, {
      categoryId: input.categoryId ?? null,
      sectionId: input.sectionId ?? null,
      categoryLabel: input.category,
    });

    const recurringPayment = await prisma.recurringPayment.create({
      data: {
        userId,
        accountId: account.id,
        name,
        amount,
        category: taxonomy.categoryLabel,
        categoryId: taxonomy.categoryId,
        sectionId: taxonomy.sectionId,
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

    const shouldResolveTaxonomy = input.categoryId !== undefined || input.sectionId !== undefined || input.category !== undefined;
    const taxonomy = shouldResolveTaxonomy
      ? await this.resolveTaxonomy(userId, {
          categoryId: input.categoryId ?? null,
          sectionId: input.sectionId ?? null,
          categoryLabel: input.category,
          fallbackCategoryLabel: existing.category,
        })
      : null;

    const recurringPayment = await prisma.recurringPayment.update({
      where: { id: recurringId },
      data: {
        ...(input.name !== undefined ? { name: normalizeText(input.name, 'name') } : {}),
        ...(input.amount !== undefined ? { amount: normalizeAmount(input.amount) } : {}),
        ...(taxonomy ? { category: taxonomy.categoryLabel, categoryId: taxonomy.categoryId, sectionId: taxonomy.sectionId } : {}),
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

    const paidAt = input.paidAt ?? new Date();
    const shouldCreateExpense = input.createExpense !== false;
    let transactionId: string | null = null;

    if (shouldCreateExpense) {
      const transaction = await this.transactionService.createTransaction(userId, {
        accountId: existing.accountId,
        categoryId: existing.categoryId,
        sectionId: existing.sectionId,
        amount: existing.amount,
        type: 'expense',
        title: existing.name,
        description: input.note?.trim() || `Регулярный платёж: ${existing.name}`,
        date: paidAt,
        isAIGenerated: false,
      });
      transactionId = transaction.id;
    }

    const nextDate = input.advance === false ? existing.nextDate : addPeriod(paidAt, existing.period);

    await prisma.$transaction(async (tx) => {
      await tx.recurringPaymentPayment.create({
        data: {
          userId,
          recurringPaymentId: existing.id,
          accountId: existing.accountId,
          transactionId,
          amount: existing.amount,
          paidAt,
          note: normalizeNullableText(input.note),
        },
      });

      await tx.recurringPayment.update({
        where: { id: recurringId },
        data: { nextDate },
      });

      await tx.obligationReminder.updateMany({
        where: { userId, recurringPaymentId: existing.id, status: 'scheduled' },
        data: { status: 'done' },
      });
    });

    const recurringPayment = await prisma.recurringPayment.findUniqueOrThrow({
      where: { id: recurringId },
      include: recurringInclude,
    });

    return serializeRecurring(recurringPayment);
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

  private async resolveTaxonomy(
    userId: string,
    input: {
      categoryId?: string | null;
      sectionId?: string | null;
      categoryLabel?: string | null;
      fallbackCategoryLabel?: string | null;
    },
  ) {
    let sectionId = input.sectionId ?? null;
    if (sectionId) {
      const section = await prisma.section.findFirst({ where: { id: sectionId, userId }, select: { id: true } });
      if (!section) throw new NotFoundError('Section not found');
    }

    if (!input.categoryId) {
      return {
        categoryId: null as string | null,
        sectionId,
        categoryLabel: normalizeOptionalText(input.categoryLabel, input.fallbackCategoryLabel || 'Регулярный платёж'),
      };
    }

    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true, name: true, sectionId: true, type: true },
    });

    if (!category) throw new NotFoundError('Category not found');
    if (category.type !== 'expense') throw new BadRequestError('Recurring payment category must be an expense category');

    return {
      categoryId: category.id,
      sectionId: sectionId ?? category.sectionId ?? null,
      categoryLabel: category.name,
    };
  }
}

export const recurringService = new RecurringService();
