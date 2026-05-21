import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { AIParsedCommand, AIValidatedAction } from './types';
import { progressionActivityBridge } from '../progression/activity-bridge.service';
import { aiPremiumService } from './ai-premium.service';
import { aiCompanionService } from './ai-companion.service';
import { aiAnalyticsService } from './ai-analytics.service';

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
        const claimed = await tx.aIPendingAction.updateMany({
          where: { id: options.pendingActionId, userId, status: 'pending' },
          data: { status: 'confirmed', confirmedAt: new Date() },
        });

        if (claimed.count !== 1) {
          throw new BadRequestError('Pending action was already processed or expired');
        }
      }

      return actionResults;
    });

    await progressionActivityBridge.trackAIExecution(userId, parsed, results);
    await aiCompanionService.recordExecution(userId, { tools: parsed.actions.map((action) => action.tool), result: results, source: 'ai' });

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
    const tool = String(action.tool);

    if (tool === 'create_account') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Account name is required');

      const existingAccountId = typeof resolved.existingAccountId === 'string' ? resolved.existingAccountId : '';
      if (existingAccountId) {
        const account = await this.getAccount(tx, userId, existingAccountId);
        this.rememberAccount(createdAccountNames, name, account.id);
        this.rememberAccount(createdAccountNames, account.name, account.id);
        return { tool, account, skipped: true, reason: 'account_already_exists' };
      }

      const existing = await tx.account.findFirst({ where: { userId, name } });
      if (existing) {
        this.rememberAccount(createdAccountNames, name, existing.id);
        this.rememberAccount(createdAccountNames, existing.name, existing.id);
        return { tool, account: existing, skipped: true, reason: 'account_already_exists' };
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
      return { tool, account };
    }

    if (tool === 'update_account') {
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
      return { tool, account };
    }

    if (tool === 'delete_account') {
      const accountId = this.requireString(resolved.accountId, 'accountId');
      const account = await this.deleteAccountsByIds(tx, userId, [accountId]);
      return { tool, deleted: account };
    }

    if (tool === 'delete_accounts') {
      const accountIds = Array.isArray(resolved.accountIds)
        ? resolved.accountIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];

      if (accountIds.length === 0) throw new BadRequestError('No accounts selected for deletion');
      const deleted = await this.deleteAccountsByIds(tx, userId, accountIds);
      return { tool, deleted, count: deleted.length };
    }

    if (tool === 'set_primary_account') {
      const accountId = this.requireString(resolved.accountId, 'accountId');
      const scope = input.scope === 'expense' || input.scope === 'income' || input.scope === 'both' ? input.scope : 'both';
      const data: Record<string, unknown> = {};

      if (scope === 'expense' || scope === 'both') data.defaultExpenseAccountId = accountId;
      if (scope === 'income' || scope === 'both') data.defaultIncomeAccountId = accountId;

      const settings = await tx.userAISettings.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });

      const account = await this.getAccount(tx, userId, accountId);
      return { tool, account, settings, scope };
    }

    if (tool === 'create_transaction') {
      const accountId = await this.resolveTransactionAccountId(tx, userId, input, resolved, createdAccountNames);
      const kind = input.kind === 'income' ? 'income' : 'expense';
      const amount = this.toInteger(resolved.amountInAccountCurrency ?? input.amount, 0);
      if (amount <= 0) throw new BadRequestError('Transaction amount must be positive');

      const sectionId = typeof resolved.sectionId === 'string'
        ? resolved.sectionId
        : await this.findOrCreateSectionId(tx, userId, typeof input.section === 'string' ? input.section : '');

      const categoryId = await this.findOrCreateCategoryId(tx, userId, {
        name: typeof input.category === 'string' ? input.category : '',
        type: kind,
        sectionId,
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
          sectionId,
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

      return { tool, transaction };
    }

    if (tool === 'transfer_money') {
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

      return { tool, transaction };
    }

    if (tool === 'create_category') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Category name is required');
      const existing = await tx.category.findFirst({ where: { userId, name } });
      if (existing) return { tool, category: existing, skipped: true, reason: 'category_already_exists' };
      const category = await tx.category.create({
        data: {
          userId,
          name,
          type: input.type === 'income' ? 'income' : 'expense',
          sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
        },
      });
      return { tool, category };
    }

    if (tool === 'create_section') {
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Section name is required');
      const existing = await tx.section.findFirst({ where: { userId, name } });
      if (existing) return { tool, section: existing, skipped: true, reason: 'section_already_exists' };
      const section = await tx.section.create({ data: { userId, name } });
      return { tool, section };
    }


    if (tool === 'show_goals') {
      const goals = await tx.goal.findMany({
        where: { userId },
        include: { account: { select: { id: true, name: true, currency: true, icon: true, color: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });
      return { tool, goals };
    }

    if (tool === 'create_goal') {
      const title = this.cleanString(input.title);
      const targetAmount = this.toInteger(input.targetAmount, 0);
      if (!title) throw new BadRequestError('Goal title is required');
      if (targetAmount <= 0) throw new BadRequestError('Goal target amount must be positive');

      const existing = await tx.goal.findFirst({ where: { userId, title, status: { not: 'archived' } } });
      if (existing) return { tool, goal: existing, skipped: true, reason: 'goal_already_exists' };

      const goal = await tx.goal.create({
        data: {
          userId,
          title,
          targetAmount,
          currentAmount: this.toInteger(input.currentAmount, 0),
          currency: this.cleanString(input.currency).toUpperCase() || 'RUB',
          accountId: typeof resolved.accountId === 'string' ? resolved.accountId : null,
          note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null,
          status: 'active',
        },
      });
      return { tool, goal };
    }

    if (tool === 'update_goal') {
      const goalId = this.requireString(resolved.goalId, 'goalId');
      const data: Record<string, unknown> = {};
      if (typeof input.title === 'string' && input.title.trim()) data.title = input.title.trim();
      if (input.targetAmount !== null && input.targetAmount !== undefined) data.targetAmount = this.toInteger(input.targetAmount, 0);
      if (input.currentAmount !== null && input.currentAmount !== undefined) data.currentAmount = this.toInteger(input.currentAmount, 0);
      if (typeof input.status === 'string' && ['active', 'completed', 'archived'].includes(input.status)) data.status = input.status;
      if (input.note !== undefined) data.note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null;

      const goal = await tx.goal.update({ where: { id: goalId }, data });
      return { tool, goal };
    }

    if (tool === 'delete_goal') {
      const goalId = this.requireString(resolved.goalId, 'goalId');
      const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });
      if (!goal) throw new NotFoundError('Goal not found');
      await tx.goal.delete({ where: { id: goalId } });
      return { tool, goal };
    }

    if (tool === 'show_ai_settings') {
      const [settings, onboarding, accounts] = await Promise.all([
        tx.userAISettings.upsert({ where: { userId }, create: { userId }, update: {} }),
        tx.onboardingState.upsert({
          where: { userId },
          create: { userId, status: 'not_started', currentStep: 'create_first_account' },
          update: {},
        }),
        tx.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      ]);

      return { tool, settings, onboarding, accounts };
    }

    if (tool === 'update_ai_settings') {
      const data: Record<string, unknown> = {};

      if (typeof resolved.defaultExpenseAccountId === 'string') data.defaultExpenseAccountId = resolved.defaultExpenseAccountId;
      if (typeof resolved.defaultIncomeAccountId === 'string') data.defaultIncomeAccountId = resolved.defaultIncomeAccountId;
      if (input.autoConfirmExpenseLimit !== undefined) data.autoConfirmExpenseLimit = this.toInteger(input.autoConfirmExpenseLimit, 0);
      if (input.autoConfirmIncomeLimit !== undefined) data.autoConfirmIncomeLimit = this.toInteger(input.autoConfirmIncomeLimit, 0);
      if (input.autoConfirmTransferLimit !== undefined) data.autoConfirmTransferLimit = this.toInteger(input.autoConfirmTransferLimit, 0);
      if (input.requireConfirmForAccountActions !== undefined) data.requireConfirmForAccountActions = Boolean(input.requireConfirmForAccountActions);
      if (typeof input.companionTone === 'string') data.companionTone = input.companionTone;

      const settings = await tx.userAISettings.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });

      return { tool, settings };
    }

    if (tool === 'apply_ai_settings_preset') {
      const preset = typeof input.preset === 'string' ? input.preset : 'balanced';
      const config = this.presetConfig(preset);
      const accounts = await tx.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
      const defaultExpenseAccountId = accounts.find((account) => account.type === 'cash')?.id
        ?? accounts.find((account) => account.type === 'card')?.id
        ?? accounts[0]?.id
        ?? null;
      const defaultIncomeAccountId = accounts.find((account) => account.type === 'card')?.id
        ?? accounts[0]?.id
        ?? null;

      const settings = await tx.userAISettings.upsert({
        where: { userId },
        create: {
          userId,
          preset,
          ...config,
          ...(preset !== 'strict' ? { defaultExpenseAccountId, defaultIncomeAccountId } : {}),
        },
        update: {
          preset,
          ...config,
          ...(preset !== 'strict' ? { defaultExpenseAccountId, defaultIncomeAccountId } : {}),
        },
      });

      return { tool, settings };
    }

    if (tool === 'update_onboarding_state') {
      const status = typeof input.status === 'string' ? input.status : undefined;
      const currentStep = typeof input.currentStep === 'string' ? input.currentStep : undefined;
      const skipped = typeof input.skipped === 'boolean' ? input.skipped : undefined;
      const completedAt = status === 'completed' || skipped === true ? new Date() : undefined;

      const onboarding = await tx.onboardingState.upsert({
        where: { userId },
        create: {
          userId,
          status: status ?? 'active',
          currentStep: currentStep ?? 'create_first_account',
          skipped: skipped ?? false,
          completedAt,
        },
        update: {
          ...(status ? { status } : {}),
          ...(currentStep !== undefined ? { currentStep } : {}),
          ...(skipped !== undefined ? { skipped } : {}),
          ...(completedAt ? { completedAt } : {}),
        },
      });

      return { tool, onboarding };
    }

    if (tool === 'restart_onboarding') {
      const onboarding = await tx.onboardingState.upsert({
        where: { userId },
        create: { userId, status: 'active', currentStep: 'create_first_account', skipped: false },
        update: { status: 'active', currentStep: 'create_first_account', skipped: false, completedAt: null, meta: null },
      });

      return { tool, onboarding };
    }


    if (tool === 'query_analytics') {
      const analytics = await aiAnalyticsService.query(userId, input);
      return { tool, analytics };
    }

    if (tool === 'undo_last_action') {
      const transaction = await tx.transaction.findFirst({
        where: { userId, isAIGenerated: true },
        orderBy: [{ createdAt: 'desc' }],
      });

      if (!transaction) return { tool, skipped: true, reason: 'nothing_to_undo' };

      await this.applyBalanceEffect(tx, {
        type: transaction.type as 'income' | 'expense' | 'transfer',
        amount: transaction.amount,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
        direction: 'revert',
      });

      await tx.transaction.delete({ where: { id: transaction.id } });

      return { tool, undone: { transactionId: transaction.id, type: transaction.type, amount: transaction.amount } };
    }

    if (tool === 'show_companion_reactions') {
      const events = await aiCompanionService.list(userId, input);
      return { tool, events };
    }

    if (tool === 'mark_companion_reactions_seen') {
      const result = await aiCompanionService.markSeen(userId);
      return { tool, result };
    }

    if (tool === 'show_premium_capabilities') {
      const capabilities = await aiPremiumService.getCapabilities(userId);
      return { tool, capabilities };
    }


    if (tool === 'show_accounts') {
      const accounts = await tx.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
      return { tool, accounts };
    }

    if (tool === 'show_transactions') {
      const transactions = await tx.transaction.findMany({
        where: { userId },
        include: transactionInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(Number(input.limit ?? 20), 1), 100),
      });
      return { tool, transactions };
    }

    return { tool, skipped: true };
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

  private async findOrCreateSectionId(
    tx: Prisma.TransactionClient,
    userId: string,
    rawName: string,
  ) {
    const name = rawName.trim();
    if (!name) return null;

    const existing = await tx.section.findFirst({ where: { userId, name } });
    if (existing) return existing.id;

    const created = await tx.section.create({
      data: {
        userId,
        name,
      },
    });

    return created.id;
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

  private presetConfig(preset: string) {
    if (preset === 'strict') {
      return {
        autoConfirmExpenseLimit: 0,
        autoConfirmIncomeLimit: 0,
        autoConfirmTransferLimit: 0,
        requireConfirmForAccountActions: true,
        companionTone: 'calm',
      };
    }

    if (preset === 'simple') {
      return {
        autoConfirmExpenseLimit: 1000,
        autoConfirmIncomeLimit: 250000,
        autoConfirmTransferLimit: 0,
        requireConfirmForAccountActions: true,
        companionTone: 'coach',
      };
    }

    return {
      autoConfirmExpenseLimit: 500,
      autoConfirmIncomeLimit: 100000,
      autoConfirmTransferLimit: 0,
      requireConfirmForAccountActions: true,
      companionTone: 'friendly',
    };
  }

  private async deleteAccountsByIds(tx: Prisma.TransactionClient, userId: string, accountIds: string[]) {
    const uniqueIds = Array.from(new Set(accountIds));
    const accounts = await tx.account.findMany({ where: { userId, id: { in: uniqueIds } } });

    if (accounts.length === 0) throw new NotFoundError('Accounts not found');

    await tx.userAISettings.updateMany({
      where: {
        userId,
        OR: [
          { defaultExpenseAccountId: { in: uniqueIds } },
          { defaultIncomeAccountId: { in: uniqueIds } },
        ],
      },
      data: { defaultExpenseAccountId: null, defaultIncomeAccountId: null },
    });

    await tx.recurringPayment.deleteMany({ where: { userId, accountId: { in: uniqueIds } } });
    await tx.transaction.deleteMany({
      where: {
        userId,
        OR: [{ accountId: { in: uniqueIds } }, { toAccountId: { in: uniqueIds } }],
      },
    });
    await tx.goal.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
    await tx.account.deleteMany({ where: { userId, id: { in: uniqueIds } } });

    return accounts;
  }

  private requireString(value: unknown, fieldName: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestError(`${fieldName} is required`);
    }
    return value;
  }
}
