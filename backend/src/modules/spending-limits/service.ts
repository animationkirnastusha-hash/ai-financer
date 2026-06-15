import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type SpendingLimitPeriod = 'daily' | 'weekly' | 'monthly';
export type SpendingLimitTargetType = 'account' | 'category' | 'total';

export interface CreateSpendingLimitInput {
  targetType: SpendingLimitTargetType;
  accountId?: string | null;
  categoryId?: string | null;
  amount: number;
  period?: SpendingLimitPeriod;
  notifyAt?: number;
  isActive?: boolean;
}

export interface UpdateSpendingLimitInput {
  targetType?: SpendingLimitTargetType;
  accountId?: string | null;
  categoryId?: string | null;
  amount?: number;
  period?: SpendingLimitPeriod;
  notifyAt?: number;
  isActive?: boolean;
}

type LimitWithRelations = Awaited<ReturnType<typeof prisma.spendingLimit.findFirst>>;

const PERIODS = new Set(['daily', 'weekly', 'monthly']);
const PERIOD_ALIASES: Record<string, SpendingLimitPeriod> = {
  day: 'daily',
  daily: 'daily',
  week: 'weekly',
  weekly: 'weekly',
  month: 'monthly',
  monthly: 'monthly',
};
const TARGET_TYPES = new Set(['account', 'category', 'total']);

export class SpendingLimitService {
  async getUserLimits(userId: string) {
    const limits = await prisma.spendingLimit.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(limits.map((limit) => this.withUsage(userId, limit)));
  }

  async getLimitById(userId: string, limitId: string) {
    const limit = await prisma.spendingLimit.findFirst({
      where: { id: limitId, userId },
      include: { account: true, category: true },
    });

    if (!limit) throw new NotFoundError('Spending limit not found');
    return this.withUsage(userId, limit);
  }

  async createLimit(userId: string, input: CreateSpendingLimitInput) {
    const normalized = await this.normalizeInput(userId, input, true);

    const limit = await prisma.spendingLimit.create({
      data: {
        userId,
        targetType: normalized.targetType,
        accountId: normalized.accountId,
        categoryId: normalized.categoryId,
        amount: normalized.amount,
        period: normalized.period,
        notifyAt: normalized.notifyAt,
        isActive: normalized.isActive,
      },
      include: { account: true, category: true },
    });

    return this.withUsage(userId, limit);
  }

  async updateLimit(userId: string, limitId: string, input: UpdateSpendingLimitInput) {
    const existing = await prisma.spendingLimit.findFirst({ where: { id: limitId, userId } });
    if (!existing) throw new NotFoundError('Spending limit not found');

    const mergedInput: CreateSpendingLimitInput = {
      targetType: (input.targetType ?? existing.targetType) as SpendingLimitTargetType,
      accountId: input.accountId !== undefined ? input.accountId : existing.accountId,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      amount: input.amount !== undefined ? input.amount : existing.amount,
      period: (input.period ?? existing.period) as SpendingLimitPeriod,
      notifyAt: input.notifyAt !== undefined ? input.notifyAt : existing.notifyAt,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
    };

    const normalized = await this.normalizeInput(userId, mergedInput, false);

    const limit = await prisma.spendingLimit.update({
      where: { id: limitId },
      data: {
        targetType: normalized.targetType,
        accountId: normalized.accountId,
        categoryId: normalized.categoryId,
        amount: normalized.amount,
        period: normalized.period,
        notifyAt: normalized.notifyAt,
        isActive: normalized.isActive,
      },
      include: { account: true, category: true },
    });

    return this.withUsage(userId, limit);
  }

  async deleteLimit(userId: string, limitId: string) {
    const existing = await prisma.spendingLimit.findFirst({
      where: { id: limitId, userId },
      include: { account: true, category: true },
    });

    if (!existing) throw new NotFoundError('Spending limit not found');
    await prisma.spendingLimit.delete({ where: { id: limitId } });
    return existing;
  }

  private async normalizeInput(userId: string, input: CreateSpendingLimitInput | UpdateSpendingLimitInput, requireAmount: boolean) {
    const targetType = String(input.targetType ?? '').trim() as SpendingLimitTargetType;
    if (!TARGET_TYPES.has(targetType)) {
      throw new BadRequestError('targetType must be account, category or total');
    }

    const amount = input.amount !== undefined ? Number(input.amount) : undefined;
    if ((requireAmount || amount !== undefined) && (!Number.isFinite(amount) || Number(amount) <= 0)) {
      throw new BadRequestError('Limit amount must be greater than 0');
    }

    const periodRaw = String(input.period ?? 'monthly').trim().toLowerCase();
    const period = PERIOD_ALIASES[periodRaw];
    if (!period || !PERIODS.has(period)) throw new BadRequestError('period must be daily, weekly or monthly');

    const notifyAt = input.notifyAt !== undefined ? Number(input.notifyAt) : 80;
    if (!Number.isFinite(notifyAt) || notifyAt < 1 || notifyAt > 100) {
      throw new BadRequestError('notifyAt must be between 1 and 100');
    }

    let accountId: string | null = null;
    let categoryId: string | null = null;

    if (targetType === 'account') {
      accountId = typeof input.accountId === 'string' ? input.accountId : null;
      if (!accountId) throw new BadRequestError('accountId is required for account limit');
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) throw new NotFoundError('Account not found');
    }

    if (targetType === 'category') {
      categoryId = typeof input.categoryId === 'string' ? input.categoryId : null;
      if (!categoryId) throw new BadRequestError('categoryId is required for category limit');
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId, type: 'expense' } });
      if (!category) throw new NotFoundError('Expense category not found');
    }

    return {
      targetType,
      accountId,
      categoryId,
      amount: Number(amount ?? 0),
      period,
      notifyAt,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    };
  }

  private async withUsage(userId: string, limit: NonNullable<LimitWithRelations>) {
    const now = new Date();
    const startDate = this.getPeriodStart(now, limit.period);

    const where: any = {
      userId,
      type: 'expense',
      date: { gte: startDate, lte: now },
    };

    if (limit.targetType === 'account') where.accountId = limit.accountId;
    if (limit.targetType === 'category') where.categoryId = limit.categoryId;

    const aggregate = await prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    });

    const spent = aggregate._sum.amount ?? 0;
    const percent = limit.amount > 0 ? Math.round((spent / limit.amount) * 100) : 0;

    return {
      ...limit,
      usage: {
        spent,
        remaining: Math.max(limit.amount - spent, 0),
        percent,
        periodStartedAt: startDate.toISOString(),
      },
    };
  }

  private getPeriodStart(date: Date, period: string) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    if (period === 'daily') return current;

    if (period === 'weekly') {
      const day = current.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      current.setDate(current.getDate() + diff);
      return current;
    }

    current.setDate(1);
    return current;
  }
}

export const spendingLimitService = new SpendingLimitService();
