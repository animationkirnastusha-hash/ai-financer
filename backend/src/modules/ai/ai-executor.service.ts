import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { AIParsedCommand, AIValidatedAction } from './types';
import { progressionActivityBridge } from '../progression/activity-bridge.service';

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

type ExecuteOptions = {
  pendingActionId?: string;
};

export class AIExecutorService {
  async execute(userId: string, parsed: AIParsedCommand, options: ExecuteOptions = {}) {
    const results = await prisma.$transaction(async (tx) => {
      const createdAccountNames = new Map<string, string>();
      const actionResults: unknown[] = [];

      for (const action of parsed.actions) {
        const result = await this.executeAction(tx, userId, action, createdAccountNames);
        actionResults.push(result);
      }

      if (options.pendingActionId) {
        await tx.aIPendingAction.updateMany({
          where: { id: options.pendingActionId, userId, status: 'pending' },
          data: { status: 'confirmed', confirmedAt: new Date() },
        });
      }

      return actionResults;
    });

    await progressionActivityBridge.trackAIExecution(userId, parsed, results);

    return {
      summary: parsed.summary,
      actionsCount: parsed.actions.length,
      atomic: true,
      results,
    };
  }

  private async executeAction(
    tx: Prisma.TransactionClient,
    userId: string,
    action: AIValidatedAction,
    createdAccountNames: Map<string, string>,
  ) {
    const input = action.input;
    const resolved = action.resolved ?? {};

    if (action.tool === 'create_account') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Account name is required');

      const existingAccountId = typeof resolved.existingAccountId === 'string' ? resolved.existingAccountId : '';
      if (existingAccountId) {
        const account = await this.getAccount(tx, userId, existingAccountId);
        this.rememberAccount(createdAccountNames, name, account.id);
        this.rememberAccount(createdAccountNames, account.name, account.id);
        return { tool: action.tool, account, skipped: true, reason: 'account_already_exists' };
      }

      const existing = await tx.account.findFirst({ where: { userId, name } });
      if (existing) {
        this.rememberAccount(createdAccountNames, name, existing.id);
        this.rememberAccount(createdAccountNames, existing.name, existing.id);
        return { tool: action.tool, account: existing, skipped: true, reason: 'account_already_exists' };
      }

      const account = await tx.account.create({
        data: {
          userId,
          name,
          type: this.cleanString(input.type) || 'cash',
          currency: this.cleanString(input.currency).toUpperCase() || 'RUB',
          balance: this.toInteger(input.initialBalance, 0),
          showInTotalBalance: true,
          lockRename: false,
          lockSpending: false,
          lockTransfers: false,
          lockBalance: false,
          lockVisibility: false,
          icon: '💳',
          color: '#5B8DEF',
        },
      });

      this.rememberAccount(createdAccountNames, name, account.id);
      this.rememberAccount(createdAccountNames, account.name, account.id);
      return { tool: action.tool, account };
    }

    if (action.tool === 'update_account') {
      const accountId = this.requireString(resolved.accountId, 'accountId');
      const account = await tx.account.update({
        where: { id: accountId },
        data: {
          ...(input.name ? { name: String(input.name).trim() } : {}),
          ...(input.type ? { type: String(input.type).trim() } : {}),
          ...(input.currency ? { currency: String(input.currency).trim().toUpperCase() } : {}),
          ...(input.balance !== null && input.balance !== undefined ? { balance: this.toInteger(input.balance, 0) } : {}),
        },
      });
      return { tool: action.tool, account };
    }

    if (action.tool === 'delete_account') {
      const accountId = this.requireString(resolved.accountId, 'accountId');
      const account = await this.getAccount(tx, userId, accountId);
      await tx.account.delete({ where: { id: accountId } });
      return { tool: action.tool, account };
    }

    if (action.tool === 'create_transaction') {
      const accountId = await this.resolveTransactionAccountId(tx, userId, input, resolved, createdAccountNames);
      const kind = input.kind === 'income' ? 'income' : 'expense';
      const amount = this.toInteger(resolved.amountInAccountCurrency ?? input.amount, 0);
      if (amount <= 0) throw new BadRequestError('Transaction amount must be positive');

      const categoryId = await this.findOrCreateCategoryId(tx, userId, {
        name: typeof input.category === 'string' ? input.category : '',
        type: kind,
        sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
      });

      await this.applyBalanceEffect(tx, {
        type: kind,
        amount,
        accountId,
        direction: 'apply',
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
          amount,
          type: kind,
          description: typeof input.description === 'string' && input.description.trim()
            ? input.description.trim()
            : kind === 'income'
              ? 'Пополнение счёта'
              : 'Расход',
          date: new Date(),
          isAIGenerated: true,
        },
        include: transactionInclude,
      });

      return { tool: action.tool, transaction };
    }

    if (action.tool === 'transfer_money') {
      const fromAccountId = this.requireString(resolved.fromAccountId, 'fromAccountId');
      const toAccountId = this.requireString(resolved.toAccountId, 'toAccountId');
      const amount = this.toInteger(resolved.amountInFromCurrency ?? input.amount, 0);
      if (amount <= 0) throw new BadRequestError('Transfer amount must be positive');
      if (fromAccountId === toAccountId) throw new BadRequestError('Cannot transfer to the same account');

      await this.applyBalanceEffect(tx, {
        type: 'transfer',
        amount,
        accountId: fromAccountId,
        toAccountId,
        direction: 'apply',
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: fromAccountId,
          toAccountId,
          amount,
          type: 'transfer',
          description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : 'Перевод между счетами',
          date: new Date(),
          isAIGenerated: true,
        },
        include: transactionInclude,
      });

      return { tool: action.tool, transaction };
    }

    if (action.tool === 'create_category') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Category name is required');
      const existing = await tx.category.findFirst({ where: { userId, name } });
      if (existing) return { tool: action.tool, category: existing, skipped: true, reason: 'category_already_exists' };
      const category = await tx.category.create({
        data: {
          userId,
          name,
          type: input.type === 'income' ? 'income' : 'expense',
          sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
        },
      });
      return { tool: action.tool, category };
    }

    if (action.tool === 'create_section') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Section name is required');
      const existing = await tx.section.findFirst({ where: { userId, name } });
      if (existing) return { tool: action.tool, section: existing, skipped: true, reason: 'section_already_exists' };
      const section = await tx.section.create({ data: { userId, name } });
      return { tool: action.tool, section };
    }

    if (action.tool === 'show_accounts') {
      const accounts = await tx.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
      return { tool: action.tool, accounts };
    }

    if (action.tool === 'show_transactions') {
      const transactions = await tx.transaction.findMany({
        where: { userId },
        include: transactionInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(Number(input.limit ?? 20), 1), 100),
      });
      return { tool: action.tool, transactions };
    }

    return { tool: action.tool, skipped: true };
  }

  private async resolveTransactionAccountId(
    tx: Prisma.TransactionClient,
    userId: string,
    input: Record<string, unknown>,
    resolved: Record<string, unknown>,
    createdAccountNames: Map<string, string>,
  ) {
    if (typeof resolved.accountId === 'string') return resolved.accountId;

    const pendingAccountName = typeof resolved.pendingAccountName === 'string' ? resolved.pendingAccountName : '';
    if (pendingAccountName) {
      const createdId = createdAccountNames.get(this.key(pendingAccountName));
      if (createdId) return createdId;
    }

    const inputAccount = this.cleanString(input.account);
    if (inputAccount) {
      const createdId = createdAccountNames.get(this.key(inputAccount));
      if (createdId) return createdId;

      const account = await this.resolveAccount(tx, userId, inputAccount);
      if (account) return account.id;
    }

    throw new Error('Cannot execute transaction: account was not resolved');
  }

  private async findOrCreateCategoryId(
    tx: Prisma.TransactionClient,
    userId: string,
    params: { name: string; type: 'income' | 'expense'; sectionId?: string | null },
  ) {
    const name = params.name.trim();
    if (!name) return null;

    const existing = await tx.category.findFirst({ where: { userId, name } });
    if (existing) return existing.id;

    const created = await tx.category.create({
      data: {
        userId,
        name,
        type: params.type,
        sectionId: params.sectionId ?? null,
      },
    });

    return created.id;
  }

  private async applyBalanceEffect(
    tx: Prisma.TransactionClient,
    params: {
      type: 'income' | 'expense' | 'transfer';
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
        data: { balance: { increment: params.amount * multiplier } },
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

    if (!params.toAccountId) throw new BadRequestError('Transfer requires destination account');

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

    await tx.account.update({ where: { id: params.accountId }, data: { balance: { increment: params.amount } } });
    await tx.account.update({ where: { id: params.toAccountId }, data: { balance: { decrement: params.amount } } });
  }

  private async ensureEnoughBalance(tx: Prisma.TransactionClient, accountId: string, amount: number) {
    const account = await tx.account.findUnique({ where: { id: accountId }, select: { balance: true, name: true } });
    if (!account) throw new NotFoundError('Account not found');
    if (account.balance < amount) {
      throw new BadRequestError(`Недостаточно средств на счёте ${account.name}: баланс ${account.balance}, нужно ${amount}`);
    }
  }

  private async getAccount(tx: Prisma.TransactionClient, userId: string, accountId: string) {
    const account = await tx.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }

  private async resolveAccount(tx: Prisma.TransactionClient, userId: string, raw: string) {
    const ref = this.key(raw);
    if (!ref) return null;
    const accounts = await tx.account.findMany({ where: { userId } });
    return accounts.find((account) => account.id === raw)
      ?? accounts.find((account) => this.key(account.name) === ref)
      ?? accounts.find((account) => this.key(account.name).includes(ref) || ref.includes(this.key(account.name)))
      ?? null;
  }

  private rememberAccount(map: Map<string, string>, name: string, id: string) {
    const key = this.key(name);
    if (key) map.set(key, id);
  }

  private key(value: string) {
    return value.trim().toLowerCase();
  }

  private cleanString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private toInteger(value: unknown, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
    return parsed;
  }

  private requireString(value: unknown, fieldName: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestError(`${fieldName} is required`);
    }
    return value;
  }
}
