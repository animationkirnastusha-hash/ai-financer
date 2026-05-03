import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/core/errors';

export interface CreateAccountInput {
  name: string;
  type: string;
  currency?: string;
  balance?: number;
  showInTotalBalance?: boolean;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  type?: string;
  currency?: string;
  showInTotalBalance?: boolean;
  icon?: string | null;
  color?: string | null;
}

const accountSelect = {
  id: true,
  userId: true,
  name: true,
  type: true,
  currency: true,
  balance: true,
  showInTotalBalance: true,
  icon: true,
  color: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      transactionsFrom: true,
      transactionsTo: true,
    },
  },
} satisfies Prisma.AccountSelect;

type AccountWithMeta = Prisma.AccountGetPayload<{
  select: typeof accountSelect;
}>;

export class AccountService {
  async getUserAccounts(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: accountSelect,
      orderBy: [{ createdAt: 'asc' }],
    });

    return accounts.map(this.serializeAccount);
  }

  async getAccountById(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return this.serializeAccount(account);
  }

  async createAccount(userId: string, input: CreateAccountInput) {
    const data = this.validateCreateInput(input);

    const account = await prisma.account.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance,
        showInTotalBalance: data.showInTotalBalance,
        icon: data.icon,
        color: data.color,
      },
      select: accountSelect,
    });

    return this.serializeAccount(account);
  }

  async updateAccount(userId: string, accountId: string, input: UpdateAccountInput) {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Account not found');
    }

    const data = this.validateUpdateInput(input);

    const updated = await prisma.account.update({
      where: { id: accountId },
      data,
      select: accountSelect,
    });

    return this.serializeAccount(updated);
  }

  async deleteAccount(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const linkedTransactionsCount = await prisma.transaction.count({
      where: {
        userId,
        OR: [{ accountId }, { toAccountId: accountId }],
      },
    });

    if (linkedTransactionsCount > 0) {
      throw new ConflictError('Cannot delete account with linked transactions');
    }

    const linkedRecurringCount = await prisma.recurringPayment.count({
      where: {
        userId,
        accountId,
      },
    });

    if (linkedRecurringCount > 0) {
      throw new ConflictError('Cannot delete account with recurring payments');
    }

    await prisma.account.delete({
      where: { id: accountId },
    });

    return this.serializeAccount(account);
  }

  async getTotalBalance(userId: string) {
    const result = await prisma.account.aggregate({
      where: {
        userId,
        showInTotalBalance: true,
      },
      _sum: {
        balance: true,
      },
    });

    return result._sum.balance ?? 0;
  }

  async getAccountsSummary(userId: string) {
    const [accounts, totalBalance, visibleBalance] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        select: accountSelect,
        orderBy: [{ createdAt: 'asc' }],
      }),
      prisma.account.aggregate({
        where: { userId },
        _sum: { balance: true },
      }),
      prisma.account.aggregate({
        where: {
          userId,
          showInTotalBalance: true,
        },
        _sum: { balance: true },
      }),
    ]);

    const serializedAccounts = accounts.map(this.serializeAccount);

    return {
      accounts: serializedAccounts,
      stats: {
        totalAccounts: serializedAccounts.length,
        totalBalance: totalBalance._sum.balance ?? 0,
        visibleBalance: visibleBalance._sum.balance ?? 0,
        hiddenBalance:
          (totalBalance._sum.balance ?? 0) - (visibleBalance._sum.balance ?? 0),
      },
    };
  }

  async recalculateAllBalances(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    const updatedAccounts = await prisma.$transaction(async (tx) => {
      const result: Array<{ id: string; balance: number }> = [];

      for (const account of accounts) {
        const transactions = await tx.transaction.findMany({
          where: {
            userId,
            OR: [{ accountId: account.id }, { toAccountId: account.id }],
          },
          select: {
            amount: true,
            type: true,
            accountId: true,
            toAccountId: true,
          },
        });

        let balance = 0;

        for (const transaction of transactions) {
          if (transaction.type === 'income' && transaction.accountId === account.id) {
            balance += transaction.amount;
            continue;
          }

          if (transaction.type === 'expense' && transaction.accountId === account.id) {
            balance -= transaction.amount;
            continue;
          }

          if (transaction.type === 'transfer') {
            if (transaction.accountId === account.id) {
              balance -= transaction.amount;
            }

            if (transaction.toAccountId === account.id) {
              balance += transaction.amount;
            }
          }
        }

        await tx.account.update({
          where: { id: account.id },
          data: { balance },
        });

        result.push({ id: account.id, balance });
      }

      return result;
    });

    return updatedAccounts;
  }

  private validateCreateInput(input: CreateAccountInput) {
    const name = input.name?.trim();
    const type = input.type?.trim();

    if (!name) {
      throw new BadRequestError('Account name is required');
    }

    if (!type) {
      throw new BadRequestError('Account type is required');
    }

    const balance =
      input.balance !== undefined ? this.normalizeInteger(input.balance, 'balance') : 0;

    return {
      name,
      type,
      currency: this.normalizeCurrency(input.currency),
      balance,
      showInTotalBalance: input.showInTotalBalance ?? true,
      icon: this.normalizeOptionalString(input.icon) ?? '💳',
      color: this.normalizeOptionalString(input.color) ?? '#5B8DEF',
    };
  }

  private validateUpdateInput(input: UpdateAccountInput) {
    const data: UpdateAccountInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestError('Account name cannot be empty');
      }
      data.name = name;
    }

    if (input.type !== undefined) {
      const type = input.type.trim();
      if (!type) {
        throw new BadRequestError('Account type cannot be empty');
      }
      data.type = type;
    }

    if (input.currency !== undefined) {
      data.currency = this.normalizeCurrency(input.currency);
    }

    if (input.showInTotalBalance !== undefined) {
      data.showInTotalBalance = Boolean(input.showInTotalBalance);
    }

    if (input.icon !== undefined) {
      data.icon = this.normalizeOptionalString(input.icon);
    }

    if (input.color !== undefined) {
      data.color = this.normalizeOptionalString(input.color);
    }

    return data;
  }

  private normalizeCurrency(currency?: string) {
    const normalized = (currency ?? 'RUB').trim().toUpperCase();

    if (!normalized) {
      throw new BadRequestError('Currency is invalid');
    }

    return normalized;
  }

  private normalizeInteger(value: number, fieldName: string) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new BadRequestError(`${fieldName} must be an integer`);
    }

    return parsed;
  }

  private normalizeOptionalString(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const normalized = value.trim();
    return normalized || null;
  }

  private serializeAccount(account: AccountWithMeta) {
    const transactionCount =
      (account._count?.transactionsFrom ?? 0) + (account._count?.transactionsTo ?? 0);

    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      showInTotalBalance: account.showInTotalBalance,
      icon: account.icon,
      color: account.color,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      transactionCount,
    };
  }
}