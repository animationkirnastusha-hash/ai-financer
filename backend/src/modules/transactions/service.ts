import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  sectionId?: string;
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
  sectionId?: string | null;
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
  sectionId?: string | null;
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
} satisfies Prisma.TransactionInclude;

export class TransactionService {
  async getUserTransactions(userId: string, filters: TransactionFilters = {}) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
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



  async getLatestTransaction(userId: string) {
    return prisma.transaction.findFirst({
      where: { userId },
      include: transactionInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getMonthlyStats(
    userId: string,
    options: { startDate?: Date; endDate?: Date } = {},
  ) {
    const now = new Date();
    const startDate = options.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = options.endDate ?? now;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: transactionInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);

    const expenses = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);

    const categoryMap = new Map<string, { name: string; icon?: string | null; amount: number; count: number }>();

    for (const item of transactions) {
      if (item.type !== 'expense' || !item.category) continue;

      const key = item.category.id;
      const current = categoryMap.get(key) ?? {
        name: item.category.name,
        icon: item.category.icon,
        amount: 0,
        count: 0,
      };

      current.amount += item.amount;
      current.count += 1;
      categoryMap.set(key, current);
    }

    const topCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      income,
      expenses,
      balance: income - expenses,
      count: transactions.length,
      topCategories,
      transactions,
    };
  }

  async createTransaction(userId: string, input: CreateTransactionInput) {
    this.validateCreateInput(input);

    const account = await this.ensureOwnedAccount(userId, input.accountId);
    const toAccount =
      input.type === 'transfer'
        ? await this.ensureOwnedAccount(userId, input.toAccountId!)
        : null;

    if (input.type === 'expense' && account.lockSpending) {
      throw new BadRequestError('Spending from this account is locked');
    }

    if (input.type === 'transfer' && account.lockTransfers) {
      throw new BadRequestError('Transfers from this account are locked');
    }

    if (input.type === 'transfer' && account.id === toAccount!.id) {
      throw new BadRequestError('Cannot transfer to the same account');
    }

    if (input.categoryId) {
      await this.ensureOwnedCategory(userId, input.categoryId, input.type);
    }

    const amount = this.normalizeAmount(input.amount);

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
          sectionId: input.type === 'transfer' ? null : input.sectionId ?? null,
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

    const nextSectionId =
      nextType === 'transfer'
        ? null
        : (input.sectionId !== undefined ? input.sectionId : existing.sectionId);

    const nextAmount = this.normalizeAmount(input.amount ?? existing.amount);
    const nextDescription =
      input.description !== undefined
        ? input.description?.trim() || null
        : existing.description;
    const nextDate = input.date ?? existing.date;

    const nextAccount = await this.ensureOwnedAccount(userId, nextAccountId);

    if (nextType === 'expense' && nextAccount.lockSpending) {
      throw new BadRequestError('Spending from this account is locked');
    }

    if (nextType === 'transfer' && nextAccount.lockTransfers) {
      throw new BadRequestError('Transfers from this account are locked');
    }

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
          sectionId: nextSectionId,
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

    if (input.type === 'transfer' && input.sectionId) {
      throw new BadRequestError('Transfer cannot have sectionId');
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


  private async ensureEnoughBalance(tx: Prisma.TransactionClient, accountId: string, amount: number) {
    const account = await tx.account.findUnique({
      where: { id: accountId },
      select: { balance: true, name: true },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.balance < amount) {
      throw new BadRequestError(`Insufficient funds on account ${account.name}: balance ${account.balance}, required ${amount}`);
    }
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
      if (params.direction === 'apply') {
        const updated = await tx.account.updateMany({
          where: { id: params.accountId, balance: { gte: params.amount } },
          data: { balance: { decrement: params.amount } },
        });

        if (updated.count !== 1) {
          await this.ensureEnoughBalance(tx, params.accountId, params.amount);
          throw new BadRequestError('Insufficient funds');
        }
      } else {
        await tx.account.update({
          where: { id: params.accountId },
          data: { balance: { increment: params.amount } },
        });
      }
      return;
    }

    if (!params.toAccountId) {
      throw new BadRequestError('Transfer requires destination account');
    }

    if (params.direction === 'apply') {
      const updated = await tx.account.updateMany({
        where: { id: params.accountId, balance: { gte: params.amount } },
        data: { balance: { decrement: params.amount } },
      });

      if (updated.count !== 1) {
        await this.ensureEnoughBalance(tx, params.accountId, params.amount);
        throw new BadRequestError('Insufficient funds');
      }

      await tx.account.update({
        where: { id: params.toAccountId },
        data: { balance: { increment: params.amount } },
      });
      return;
    }

    await tx.account.update({
      where: { id: params.accountId },
      data: { balance: { increment: params.amount } },
    });

    await tx.account.update({
      where: { id: params.toAccountId },
      data: { balance: { decrement: params.amount } },
    });
  }
}