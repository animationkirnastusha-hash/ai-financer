import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface CreateGoalInput {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  accountId?: string | null;
  note?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  targetAmount?: number;
  currentAmount?: number;
  currency?: string;
  accountId?: string | null;
  status?: GoalStatus;
  note?: string | null;
}

const goalInclude = {
  account: {
    select: { id: true, name: true, currency: true, icon: true, color: true },
  },
} satisfies Prisma.GoalInclude;

type GoalWithAccount = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

export class GoalService {
  async list(userId: string) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: goalInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return goals.map(this.serializeGoal);
  }

  async create(userId: string, input: CreateGoalInput) {
    const data = await this.validateCreate(userId, input);
    const existing = await prisma.goal.findFirst({
      where: { userId, title: data.title, status: { not: 'archived' } },
      include: goalInclude,
    });

    if (existing) return this.serializeGoal(existing);

    const goal = await prisma.goal.create({
      data: { userId, ...data },
      include: goalInclude,
    });

    return this.serializeGoal(goal);
  }

  async update(userId: string, goalId: string, input: UpdateGoalInput) {
    const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!existing) throw new NotFoundError('Goal not found');

    const data = await this.validateUpdate(userId, input);
    const goal = await prisma.goal.update({
      where: { id: goalId },
      data,
      include: goalInclude,
    });

    return this.serializeGoal(goal);
  }

  async delete(userId: string, goalId: string) {
    const existing = await prisma.goal.findFirst({ where: { id: goalId, userId }, include: goalInclude });
    if (!existing) throw new NotFoundError('Goal not found');
    await prisma.goal.delete({ where: { id: goalId } });
    return this.serializeGoal(existing);
  }

  private async validateCreate(userId: string, input: CreateGoalInput) {
    const title = this.clean(input.title);
    if (!title) throw new BadRequestError('Goal title is required');

    const targetAmount = this.money(input.targetAmount);
    if (targetAmount <= 0) throw new BadRequestError('Goal target amount must be positive');

    const currentAmount = this.money(input.currentAmount ?? 0);
    const currency = this.currency(input.currency);
    const accountId = await this.resolveAccountId(userId, input.accountId ?? null);

    return {
      title,
      targetAmount,
      currentAmount,
      currency,
      accountId,
      note: this.clean(input.note),
      status: 'active',
    };
  }

  private async validateUpdate(userId: string, input: UpdateGoalInput) {
    const data: Record<string, unknown> = {};

    if (input.title !== undefined) {
      const title = this.clean(input.title);
      if (!title) throw new BadRequestError('Goal title cannot be empty');
      data.title = title;
    }

    if (input.targetAmount !== undefined) {
      const targetAmount = this.money(input.targetAmount);
      if (targetAmount <= 0) throw new BadRequestError('Goal target amount must be positive');
      data.targetAmount = targetAmount;
    }

    if (input.currentAmount !== undefined) {
      const currentAmount = this.money(input.currentAmount);
      if (currentAmount < 0) throw new BadRequestError('Goal current amount cannot be negative');
      data.currentAmount = currentAmount;
    }

    if (input.currency !== undefined) data.currency = this.currency(input.currency);
    if (input.accountId !== undefined) data.accountId = await this.resolveAccountId(userId, input.accountId);
    if (input.note !== undefined) data.note = this.clean(input.note);

    if (input.status !== undefined) {
      if (!['active', 'completed', 'archived'].includes(input.status)) throw new BadRequestError('Invalid goal status');
      data.status = input.status;
    }

    return data;
  }

  private async resolveAccountId(userId: string, accountId: string | null) {
    if (!accountId) return null;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
    if (!account) throw new BadRequestError('Goal account not found');
    return account.id;
  }

  private serializeGoal(goal: GoalWithAccount) {
    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
    return {
      id: goal.id,
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      currency: goal.currency,
      accountId: goal.accountId,
      account: goal.account,
      status: goal.status,
      note: goal.note,
      progress,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private money(value: unknown) {
    const num = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.floor(num));
  }

  private currency(value: unknown) {
    const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return ['RUB', 'USD', 'EUR', 'VND'].includes(upper) ? upper : 'RUB';
  }
}

export const goalService = new GoalService();
