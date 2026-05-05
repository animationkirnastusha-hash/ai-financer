import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateTransactionInput {
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount: number;
  type: TransactionType;
  description?: string | null;
  date?: Date;
  isAIGenerated?: boolean;
}

export interface UpdateTransactionInput {
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount?: number;
  type?: TransactionType;
  description?: string | null;
  date?: Date;
}

const transactionInclude = {
  account: {
    select: {
      id: true,
      name: true,
      currency: true,
      icon: true,
      color: true,
    },
  },
  toAccount: {
    select: {
      id: true,
      name: true,
      currency: true,
      icon: true,
      color: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      type: true,
    },
  },
} satisfies Prisma.TransactionInclude;

export class TransactionService {
  async getUserTransactions(userId: string, filters: TransactionFilters = {}) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            date: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    };

    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const skip = Math.max(filters.offset ?? 0, 0);

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }


  async getLatestTransaction(userId: string) {
    return prisma.transaction.findFirst({
      where: { userId },
      include: transactionInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getMonthlyStats(userId: string, options: { category?: string } = {}) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const categoryQuery = options.category?.trim().toLowerCase();

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: now,
        },
        ...(categoryQuery
          ? {
              category: {
                name: {
                  contains: categoryQuery,
                },
              },
            }
          : {}),
      },
      include: transactionInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);

    const expenses = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);

    const byCategory = new Map<string, { name: string; icon?: string | null; amount: number; count: number }>();

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;

      const key = transaction.category?.id ?? transaction.description ?? 'unknown';
      const current = byCategory.get(key) ?? {
        name: transaction.category?.name ?? transaction.description ?? 'Без категории',
        icon: transaction.category?.icon,
        amount: 0,
        count: 0,
      };

      current.amount += transaction.amount;
      current.count += 1;
      byCategory.set(key, current);
    }

    return {
      period: {
        startDate: monthStart.toISOString(),
        endDate: now.toISOString(),
      },
      income,
      expenses,
      balance: income - expenses,
      count: transactions.length,
      topCategories: [...byCategory.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
      transactions,
    };
  }

  async getTransactionById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  async createTransaction(userId: string, input: CreateTransactionInput) {
    this.validateCreateInput(input);

    const account = await this.ensureOwnedAccount(userId, input.accountId);
    const toAccount =
      input.type === 'transfer'
        ? await this.ensureOwnedAccount(userId, input.toAccountId!)
        : null;

    if (input.type === 'transfer' && account.id === toAccount!.id) {
      throw new BadRequestError('Cannot transfer to the same account');
    }

    if (input.categoryId) {
      await this.ensureOwnedCategory(userId, input.categoryId, input.type);
    }

    const amount = this.normalizeAmount(input.amount);

    await this.ensureNotRecentDuplicate(userId, {
      accountId: input.accountId,
      toAccountId: input.type === 'transfer' ? input.toAccountId ?? null : null,
      categoryId: input.type === 'transfer' ? null : input.categoryId ?? null,
      amount,
      type: input.type,
      description: input.description?.trim() || null,
    });

    const transaction = await prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, {
        type: input.type,
        amount,
        accountId: input.accountId,
        toAccountId: input.type === 'transfer' ? input.toAccountId! : null,
        direction: 'apply',
      });

      return tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          toAccountId: input.type === 'transfer' ? input.toAccountId! : null,
          categoryId: input.type === 'transfer' ? null : input.categoryId ?? null,
          amount,
          type: input.type,
          description: input.description?.trim() || null,
          date: input.date ?? new Date(),
          isAIGenerated: input.isAIGenerated ?? false,
        },
        include: transactionInclude,
      });
    });

    return transaction;
  }

  async updateTransaction(userId: string, transactionId: string, input: UpdateTransactionInput) {
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Transaction not found');
    }

    const nextType = input.type ?? (existing.type as TransactionType);
    const nextAccountId = input.accountId ?? existing.accountId;
    const nextToAccountId =
      nextType === 'transfer'
        ? (input.toAccountId ?? existing.toAccountId)
        : null;

    const nextCategoryId =
      nextType === 'transfer'
        ? null
        : (input.categoryId !== undefined ? input.categoryId : existing.categoryId);

    const nextAmount = this.normalizeAmount(input.amount ?? existing.amount);
    const nextDescription =
      input.description !== undefined
        ? input.description?.trim() || null
        : existing.description;
    const nextDate = input.date ?? existing.date;

    await this.ensureOwnedAccount(userId, nextAccountId);

    if (nextType === 'transfer') {
      if (!nextToAccountId) {
        throw new BadRequestError('Target account is required for transfer');
      }

      await this.ensureOwnedAccount(userId, nextToAccountId);

      if (nextAccountId === nextToAccountId) {
        throw new BadRequestError('Cannot transfer to the same account');
      }
    }

    if (nextCategoryId) {
      await this.ensureOwnedCategory(userId, nextCategoryId, nextType);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, {
        type: existing.type as TransactionType,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        direction: 'revert',
      });

      await this.applyBalanceEffect(tx, {
        type: nextType,
        amount: nextAmount,
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        direction: 'apply',
      });

      return tx.transaction.update({
        where: { id: existing.id },
        data: {
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
          categoryId: nextCategoryId,
          amount: nextAmount,
          type: nextType,
          description: nextDescription,
          date: nextDate,
        },
        include: transactionInclude,
      });
    });

    return updated;
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: transactionInclude,
    });

    if (!existing) {
      throw new NotFoundError('Transaction not found');
    }

    await prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, {
        type: existing.type as TransactionType,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        direction: 'revert',
      });

      await tx.transaction.delete({
        where: { id: existing.id },
      });
    });

    return existing;
  }

  private async ensureNotRecentDuplicate(
    userId: string,
    input: {
      accountId: string;
      toAccountId?: string | null;
      categoryId?: string | null;
      amount: number;
      type: TransactionType;
      description?: string | null;
    },
  ) {
    const recent = await prisma.transaction.findFirst({
      where: {
        userId,
        accountId: input.accountId,
        toAccountId: input.toAccountId ?? null,
        categoryId: input.categoryId ?? null,
        amount: input.amount,
        type: input.type,
        description: input.description ?? null,
        createdAt: {
          gte: new Date(Date.now() - 8000),
        },
      },
      select: {
        id: true,
      },
    });

    if (recent) {
      throw new BadRequestError('Похоже, такая операция уже была записана только что');
    }
  }

  private validateCreateInput(input: CreateTransactionInput) {
    if (!input.accountId) {
      throw new BadRequestError('accountId is required');
    }

    if (!input.type || !['income', 'expense', 'transfer'].includes(input.type)) {
      throw new BadRequestError('Invalid transaction type');
    }

    if (input.type === 'transfer' && !input.toAccountId) {
      throw new BadRequestError('toAccountId is required for transfer');
    }

    if (input.type !== 'transfer' && input.toAccountId) {
      throw new BadRequestError('toAccountId is only allowed for transfer');
    }

    if (input.type === 'transfer' && input.categoryId) {
      throw new BadRequestError('Transfer cannot have categoryId');
    }

    this.normalizeAmount(input.amount);
  }

  private normalizeAmount(value: number) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new BadRequestError('Amount must be a positive integer');
    }

    return amount;
  }

  private async ensureOwnedAccount(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return account;
  }

  private async ensureOwnedCategory(userId: string, categoryId: string, type: TransactionType) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (type !== 'transfer' && category.type !== type) {
      throw new BadRequestError('Category type does not match transaction type');
    }

    return category;
  }

  private async applyBalanceEffect(
    tx: Prisma.TransactionClient,
    params: {
      type: TransactionType;
      amount: number;
      accountId: string;
      toAccountId?: string | null;
      direction: 'apply' | 'revert';
    },
  ) {
    const multiplier = params.direction === 'apply' ? 1 : -1;

    if (params.type === 'income') {
      await tx.account.update({
        where: { id: params.accountId },
        data: {
          balance: {
            increment: params.amount * multiplier,
          },
        },
      });
      return;
    }

    if (params.type === 'expense') {
      await tx.account.update({
        where: { id: params.accountId },
        data: {
          balance: {
            decrement: params.amount * multiplier,
          },
        },
      });
      return;
    }

    if (!params.toAccountId) {
      throw new BadRequestError('Transfer requires destination account');
    }

    await tx.account.update({
      where: { id: params.accountId },
      data: {
        balance: {
          decrement: params.amount * multiplier,
        },
      },
    });

    await tx.account.update({
      where: { id: params.toAccountId },
      data: {
        balance: {
          increment: params.amount * multiplier,
        },
      },
    });
  }
}