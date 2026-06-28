import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';

export interface CreateAccountInput {
  name: string;
  type: string;
  currency?: string;
  balance?: number;
  showInTotalBalance?: boolean;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  type?: string;
  currency?: string;
  showInTotalBalance?: boolean;
  balance?: number;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
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
  openingBalance: true,
  showInTotalBalance: true,
  lockRename: true,
  lockSpending: true,
  lockTransfers: true,
  lockBalance: true,
  lockVisibility: true,
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

    const existing = await prisma.account.findFirst({
      where: { userId, name: { equals: data.name } },
      select: accountSelect,
    });

    if (existing) {
      throw new ConflictError('Account with this name already exists');
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance,
        openingBalance: data.balance,
        showInTotalBalance: data.showInTotalBalance,
        lockRename: data.lockRename,
        lockSpending: data.lockSpending,
        lockTransfers: data.lockTransfers,
        lockBalance: data.lockBalance,
        lockVisibility: data.lockVisibility,
        icon: data.icon,
        color: data.color,
      },
      select: accountSelect,
    });

    await progressionActivityBridge.trackAccountCreated(userId, account);

    return this.serializeAccount(account);
  }

  async updateAccount(userId: string, accountId: string, input: UpdateAccountInput) {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
        name: true,
        balance: true,
        showInTotalBalance: true,
        lockRename: true,
        lockSpending: true,
        lockTransfers: true,
        lockBalance: true,
        lockVisibility: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Account not found');
    }

    const data = this.validateUpdateInput(input);

    if (existing.lockRename && data.name !== undefined && data.name !== existing.name) {
      throw new ConflictError('Account name is locked');
    }

    if (existing.lockBalance && data.balance !== undefined && data.balance !== existing.balance) {
      throw new ConflictError('Account balance is locked');
    }

    if (existing.lockVisibility && data.showInTotalBalance !== undefined && data.showInTotalBalance !== existing.showInTotalBalance) {
      throw new ConflictError('Account visibility is locked');
    }

    if (data.balance !== undefined) {
      const transactionDelta = await this.calculateTransactionDelta(userId, accountId);
      (data as Prisma.AccountUpdateInput).openingBalance = data.balance - transactionDelta;
    }

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

    await prisma.$transaction(async (tx) => {
      const linkedTransactions = await tx.transaction.findMany({
        where: {
          userId,
          OR: [{ accountId }, { toAccountId: accountId }],
        },
        select: { id: true, type: true, amount: true, accountId: true, toAccountId: true, goalId: true },
      });
      const transactionIds = linkedTransactions.map((item) => item.id);

      for (const transaction of linkedTransactions) {
        if (transaction.type !== 'transfer') continue;

        if (transaction.accountId === accountId && transaction.toAccountId && transaction.toAccountId !== accountId) {
          await tx.account.updateMany({
            where: { userId, id: transaction.toAccountId },
            data: { balance: { decrement: transaction.amount } },
          });
        }

        if (transaction.toAccountId === accountId && transaction.accountId !== accountId) {
          await tx.account.updateMany({
            where: { userId, id: transaction.accountId },
            data: { balance: { increment: transaction.amount } },
          });
        }

        if (transaction.goalId) {
          await tx.goal.updateMany({
            where: { userId, id: transaction.goalId },
            data: { currentAmount: { decrement: transaction.amount } },
          });
        }
      }

      await tx.userAISettings.updateMany({
        where: {
          userId,
          OR: [
            { defaultExpenseAccountId: accountId },
            { defaultIncomeAccountId: accountId },
          ],
        },
        data: {
          defaultExpenseAccountId: null,
          defaultIncomeAccountId: null,
        },
      });

      await tx.goal.updateMany({ where: { userId, accountId }, data: { accountId: null } });
      await tx.loan.updateMany({ where: { userId, accountId }, data: { accountId: null } });
      await tx.loanPayment.updateMany({ where: { userId, accountId }, data: { accountId: null } });
      await tx.recurringPaymentPayment.updateMany({ where: { userId, accountId }, data: { accountId: null } });
      await tx.receiptScan.updateMany({ where: { userId, accountId }, data: { accountId: null } });

      if (transactionIds.length > 0) {
        await tx.loanPayment.updateMany({
          where: { userId, transactionId: { in: transactionIds } },
          data: { transactionId: null },
        });
        await tx.recurringPaymentPayment.updateMany({
          where: { userId, transactionId: { in: transactionIds } },
          data: { transactionId: null },
        });
        await tx.receiptScan.updateMany({
          where: { userId, transactionId: { in: transactionIds } },
          data: { transactionId: null },
        });
        await tx.transaction.deleteMany({ where: { userId, id: { in: transactionIds } } });
      }

      await tx.spendingLimit.deleteMany({ where: { userId, accountId } });
      await tx.recurringPayment.deleteMany({ where: { userId, accountId } });
      await tx.account.delete({ where: { id: accountId } });
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
      select: { id: true, openingBalance: true },
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

        let balance = account.openingBalance;

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

  private async calculateTransactionDelta(userId: string, accountId: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [{ accountId }, { toAccountId: accountId }],
      },
      select: {
        amount: true,
        type: true,
        accountId: true,
        toAccountId: true,
      },
    });

    let delta = 0;

    for (const transaction of transactions) {
      if (transaction.type === 'income' && transaction.accountId === accountId) {
        delta += transaction.amount;
        continue;
      }

      if (transaction.type === 'expense' && transaction.accountId === accountId) {
        delta -= transaction.amount;
        continue;
      }

      if (transaction.type === 'transfer') {
        if (transaction.accountId === accountId) {
          delta -= transaction.amount;
        }

        if (transaction.toAccountId === accountId) {
          delta += transaction.amount;
        }
      }
    }

    return delta;
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
      lockRename: Boolean(input.lockRename ?? false),
      lockSpending: Boolean(input.lockSpending ?? false),
      lockTransfers: Boolean(input.lockTransfers ?? false),
      lockBalance: Boolean(input.lockBalance ?? false),
      lockVisibility: Boolean(input.lockVisibility ?? false),
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


    if (input.balance !== undefined) {
      data.balance = this.normalizeInteger(input.balance, 'balance');
    }

    if (input.lockRename !== undefined) {
      data.lockRename = Boolean(input.lockRename);
    }

    if (input.lockSpending !== undefined) {
      data.lockSpending = Boolean(input.lockSpending);
    }

    if (input.lockTransfers !== undefined) {
      data.lockTransfers = Boolean(input.lockTransfers);
    }

    if (input.lockBalance !== undefined) {
      data.lockBalance = Boolean(input.lockBalance);
    }

    if (input.lockVisibility !== undefined) {
      data.lockVisibility = Boolean(input.lockVisibility);
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
      openingBalance: account.openingBalance,
      showInTotalBalance: account.showInTotalBalance,
      lockRename: account.lockRename,
      lockSpending: account.lockSpending,
      lockTransfers: account.lockTransfers,
      lockBalance: account.lockBalance,
      lockVisibility: account.lockVisibility,
      icon: account.icon,
      color: account.color,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      transactionCount,
    };
  }
}