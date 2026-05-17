import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  period?: 'monthly' | 'weekly' | 'yearly';
  notifyAt?: number;
  isActive?: boolean;
}

export interface UpdateBudgetInput {
  categoryId?: string;
  amount?: number;
  period?: 'monthly' | 'weekly' | 'yearly';
  notifyAt?: number;
  isActive?: boolean;
}

export class BudgetService {
  async getUserBudgets(userId: string) {
    return prisma.budget.findMany({
      where: { userId },
      include: {
        category: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getBudgetById(userId: string, budgetId: string) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: {
        category: true,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    return budget;
  }

  async createBudget(userId: string, input: CreateBudgetInput) {
    const amount = Number(input.amount);

    if (!input.categoryId) {
      throw new BadRequestError('categoryId is required');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError('Budget amount must be greater than 0');
    }

    const notifyAt =
      input.notifyAt !== undefined ? Number(input.notifyAt) : 80;

    if (!Number.isFinite(notifyAt) || notifyAt < 1 || notifyAt > 100) {
      throw new BadRequestError('notifyAt must be between 1 and 100');
    }

    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        userId,
        type: 'expense',
      },
    });

    if (!category) {
      throw new NotFoundError('Expense category not found');
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        categoryId: input.categoryId,
        amount,
        period: input.period ?? 'monthly',
        notifyAt,
        isActive: input.isActive ?? true,
      },
      include: {
        category: true,
      },
    });

    await progressionActivityBridge.trackBudgetCreated(userId, budget);

    return budget;
  }

  async updateBudget(userId: string, budgetId: string, input: UpdateBudgetInput) {
    const existing = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundError('Budget not found');
    }

    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          userId,
          type: 'expense',
        },
      });

      if (!category) {
        throw new NotFoundError('Expense category not found');
      }
    }

    const amount =
      input.amount !== undefined ? Number(input.amount) : undefined;

    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      throw new BadRequestError('Budget amount must be greater than 0');
    }

    const notifyAt =
      input.notifyAt !== undefined ? Number(input.notifyAt) : undefined;

    if (
      notifyAt !== undefined &&
      (!Number.isFinite(notifyAt) || notifyAt < 1 || notifyAt > 100)
    ) {
      throw new BadRequestError('notifyAt must be between 1 and 100');
    }

    return prisma.budget.update({
      where: { id: budgetId },
      data: {
        categoryId: input.categoryId,
        amount,
        period: input.period,
        notifyAt,
        isActive: input.isActive,
      },
      include: {
        category: true,
      },
    });
  }

  async deleteBudget(userId: string, budgetId: string) {
    const existing = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId,
      },
      include: {
        category: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Budget not found');
    }

    await prisma.budget.delete({
      where: { id: budgetId },
    });

    return existing;
  }

  async checkAndNotifyBudgets() {
    const budgets = await prisma.budget.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        user: true,
      },
    });

    const now = new Date();

    for (const budget of budgets) {
      const startDate = this.getPeriodStart(now, budget.period);
      const endDate = now;

      const aggregate = await prisma.transaction.aggregate({
        where: {
          userId: budget.userId,
          type: 'expense',
          categoryId: budget.categoryId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const spent = aggregate._sum.amount ?? 0;
      const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Пока просто считаем, без notificationSent, так как поля нет в схеме.
      // Здесь позже можно будет вызывать NotificationService.
      void percent;
    }
  }

  private getPeriodStart(date: Date, period: string) {
    const current = new Date(date);

    if (period === 'weekly') {
      const day = current.getDay();
      const diff = day === 0 ? 6 : day - 1;
      current.setDate(current.getDate() - diff);
      current.setHours(0, 0, 0, 0);
      return current;
    }

    if (period === 'yearly') {
      return new Date(current.getFullYear(), 0, 1);
    }

    return new Date(current.getFullYear(), current.getMonth(), 1);
  }
}