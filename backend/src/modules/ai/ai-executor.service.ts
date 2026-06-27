import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/core/errors';
import { AIParsedCommand, AIValidatedAction } from './types';
import { progressionActivityBridge } from '../progression/activity-bridge.service';
import { aiPremiumService } from './ai-premium.service';
import { aiCompanionService } from './ai-companion.service';
import { aiAnalyticsService } from './ai-analytics.service';
import { resolveCategoryAppearance, resolveSectionAppearance, shouldReplaceGenericIcon } from '../taxonomy/taxonomy-icons';
import { normalizeTransactionCategoryName, resolveTransactionSemanticTaxonomy, shouldUseTaxonomyTitleFallback } from '../taxonomy/transaction-taxonomy';
import { goalAutoSaveService } from '../goals/goal-autosave.service';

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
    void options;
    this.applyStructuredBatchGuards(parsed.actions);

    const results = await prisma.$transaction(async (tx) => {
      const createdAccountNames = new Map<string, string>();
      const actionResults: unknown[] = [];

      for (const action of parsed.actions) {
        const result = await this.executeAction(tx, userId, action, createdAccountNames);
        actionResults.push(result);
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



  private buildAITransactionTitle(params: {
    kind: 'income' | 'expense';
    rawTitle?: string | null;
    rawDescription?: string | null;
    categoryName: string;
    taxonomyTitle?: string | null;
  }) {
    const rawTitle = this.cleanString(params.rawTitle);
    const taxonomyTitle = this.cleanString(params.taxonomyTitle);

    if (rawTitle
      && !this.looksLikeTransactionCommandEcho(rawTitle)
      && !shouldUseTaxonomyTitleFallback({ rawTitle, rawDescription: params.rawDescription, categoryName: params.categoryName })) {
      return rawTitle;
    }

    if (taxonomyTitle) return taxonomyTitle;
    if (params.kind === 'income') return 'Доход';
    return params.categoryName || 'Расход';
  }

  private looksLikeTransactionCommandEcho(value: string) {
    const text = value.trim();
    if (!text) return false;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 6) return true;
    if (words.length >= 4 && /[:;·]/.test(text)) return true;
    if (/\d/.test(text) && words.length >= 3) return true;

    return false;
  }

  private applyStructuredBatchGuards(actions: AIValidatedAction[]) {
    const createAccounts = actions.filter((action) => action.tool === 'create_account');
    if (createAccounts.length !== 1) return;

    const incomeTransaction = actions.find((action) => {
      if (action.tool !== 'create_transaction') return false;
      const kind = this.cleanString(action.input.kind).toLowerCase();
      return !kind || kind === 'income';
    });

    if (!incomeTransaction) return;

    const accountName = this.cleanString(incomeTransaction.input.account);
    if (!accountName) return;

    const createAccount = createAccounts[0];
    const createName = this.cleanString(createAccount.input.name);
    if (createName === accountName) return;

    createAccount.input.name = accountName;
    delete createAccount.input.__skipCreate;

    if (createAccount.resolved && typeof createAccount.resolved === 'object') {
      delete createAccount.resolved.existingAccountId;
      delete createAccount.resolved.accountId;
    }
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
      this.rememberLastCreatedAccount(createdAccountNames, account.id);
      return { tool, account };
    }

    if (tool === 'update_account') {
      const accountId = await this.resolveAccountIdForAction(tx, userId, input, resolved, createdAccountNames, 'accountId');
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
      const accountId = await this.resolveAccountIdForAction(tx, userId, input, resolved, createdAccountNames, 'accountId');
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

      const rawTitle = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : null;
      const rawCategory = typeof input.category === 'string' && input.category.trim() ? input.category.trim() : null;
      const rawSection = typeof input.section === 'string' && input.section.trim() ? input.section.trim() : null;
      const rawDescription = typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null;
      const taxonomy = resolveTransactionSemanticTaxonomy({
        kind,
        title: rawTitle ?? rawCategory,
        description: rawDescription,
        sectionName: rawSection,
        categoryName: rawCategory,
      });

      const categoryName = normalizeTransactionCategoryName(taxonomy.categoryName, kind) || taxonomy.categoryName;
      const sectionId = null;

      const categoryId = await this.findOrCreateCategoryId(tx, userId, {
        name: categoryName,
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
          title: this.buildAITransactionTitle({
            kind,
            rawTitle,
            rawDescription,
            categoryName,
            taxonomyTitle: taxonomy.titleFallback,
          }),
          description: taxonomy.descriptionFallback
            ?? rawDescription
            ?? (kind === 'income' ? 'Пополнение счёта' : categoryName),
          date: new Date(),
          isAIGenerated: true,
        },
        include: transactionInclude,
      });

      if (kind === 'income') {
        await goalAutoSaveService.applyForIncome(tx, userId, {
          incomeTransactionId: transaction.id,
          incomeAccountId: transaction.accountId,
          incomeAmount: transaction.amount,
          currency: transaction.account.currency,
          date: transaction.date,
        });
      }

      return { tool, transaction };
    }

    if (tool === 'update_transaction') {
      const transactionId = this.requireString(resolved.transactionId, 'transactionId');
      const current = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
        include: transactionInclude,
      });
      if (!current) throw new NotFoundError('Transaction not found');

      const nextType = input.kind === 'income' || input.kind === 'expense' || input.kind === 'transfer'
        ? String(input.kind)
        : current.type;
      const nextAmount = input.amount !== null && input.amount !== undefined
        ? this.toInteger(input.amount, current.amount)
        : current.amount;
      if (nextAmount <= 0) throw new BadRequestError('Transaction amount must be positive');

      const nextAccountId = typeof resolved.accountId === 'string' ? resolved.accountId : current.accountId;
      const nextToAccountId = nextType === 'transfer'
        ? (typeof resolved.toAccountId === 'string' ? resolved.toAccountId : current.toAccountId)
        : null;

      if (nextType === 'transfer' && !nextToAccountId) {
        throw new BadRequestError('Transfer requires destination account');
      }

      await this.applyBalanceEffect(tx, {
        type: current.type as 'income' | 'expense' | 'transfer',
        amount: current.amount,
        accountId: current.accountId,
        toAccountId: current.toAccountId,
        direction: 'revert',
      });

      await this.applyBalanceEffect(tx, {
        type: nextType as 'income' | 'expense' | 'transfer',
        amount: nextAmount,
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        direction: 'apply',
      });

      const sectionId = input.section !== undefined
        ? (typeof resolved.sectionId === 'string'
          ? resolved.sectionId
          : await this.findOrCreateSectionId(tx, userId, typeof input.section === 'string' ? input.section : ''))
        : current.sectionId;

      const categoryId = input.category !== undefined && nextType !== 'transfer'
        ? await this.findOrCreateCategoryId(tx, userId, {
          name: typeof input.category === 'string' ? input.category : '',
          type: nextType === 'income' ? 'income' : 'expense',
          sectionId,
        })
        : nextType === 'transfer'
          ? null
          : current.categoryId;

      const description = input.description !== undefined
        ? (typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null)
        : current.description;

      const date = typeof input.date === 'string' && input.date.trim()
        ? this.safeDate(input.date, current.date)
        : current.date;

      const transaction = await tx.transaction.update({
        where: { id: current.id },
        data: {
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
          categoryId,
          sectionId,
          amount: nextAmount,
          type: nextType,
          description,
          date,
        },
        include: transactionInclude,
      });

      return { tool, transaction, previous: current };
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
      const kind = input.type === 'income' ? 'income' : 'expense';
      const name = normalizeTransactionCategoryName(this.cleanString(input.name), kind);
      if (!name) throw new BadRequestError('Category name is required');
      const existing = await tx.category.findFirst({ where: { userId, name } });
      if (existing) {
        const category = existing.sectionId
          ? await tx.category.update({ where: { id: existing.id }, data: { sectionId: null } })
          : existing;
        return { tool, category, skipped: true, reason: 'category_already_exists' };
      }
      const category = await tx.category.create({
        data: {
          userId,
          name,
          type: kind,
          sectionId: null,
        },
      });
      return { tool, category };
    }

    if (tool === 'update_category') {
      const categoryId = this.requireString(resolved.categoryId, 'categoryId');
      const data: Record<string, unknown> = {};
      const nextKind = input.type === 'income' ? 'income' : 'expense';
      const name = normalizeTransactionCategoryName(this.cleanString(input.name), nextKind);
      if (name) data.name = name;
      if (input.type === 'income' || input.type === 'expense') data.type = input.type;
      data.sectionId = null;
      const category = await tx.category.update({ where: { id: categoryId }, data });
      return { tool, category };
    }

    if (tool === 'delete_category') {
      const categoryId = this.requireString(resolved.categoryId, 'categoryId');
      const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) throw new NotFoundError('Category not found');
      await tx.transaction.updateMany({ where: { userId, categoryId }, data: { categoryId: null } });
      await tx.category.delete({ where: { id: categoryId } });
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

    if (tool === 'update_section') {
      const sectionId = this.requireString(resolved.sectionId, 'sectionId');
      const name = this.cleanString(input.name);
      if (!name) throw new BadRequestError('Section name is required');
      const section = await tx.section.update({ where: { id: sectionId }, data: { name } });
      return { tool, section };
    }

    if (tool === 'delete_section') {
      const sectionId = this.requireString(resolved.sectionId, 'sectionId');
      const section = await tx.section.findFirst({ where: { id: sectionId, userId } });
      if (!section) throw new NotFoundError('Section not found');
      await tx.category.updateMany({ where: { userId, sectionId }, data: { sectionId: null } });
      await tx.transaction.updateMany({ where: { userId, sectionId }, data: { sectionId: null } });
      await tx.section.delete({ where: { id: sectionId } });
      return { tool, section };
    }

    if (tool === 'assign_category_to_section') {
      const categoryId = this.requireString(resolved.categoryId, 'categoryId');
      const category = await tx.category.update({ where: { id: categoryId }, data: { sectionId: null } });
      return { tool, category, section: null, skipped: true, reason: 'sections_hidden' };
    }

    if (tool === 'show_taxonomy') {
      const [sections, categories] = await Promise.all([
        tx.section.findMany({ where: { userId }, include: { categories: true }, orderBy: { createdAt: 'asc' } }),
        tx.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      ]);
      return { tool, sections, categories };
    }


    if (tool === 'show_spending_limits') {
      const limits = await tx.spendingLimit.findMany({
        where: { userId },
        include: {
          account: { select: { id: true, name: true, currency: true, icon: true, color: true } },
          category: { select: { id: true, name: true, type: true, icon: true, color: true } },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      });
      return { tool, limits };
    }

    if (tool === 'create_spending_limit') {
      const targetType = this.cleanString(input.targetType) || 'total';
      const amount = this.toInteger(input.amount, 0);
      if (amount <= 0) throw new BadRequestError('Limit amount must be positive');
      const period = this.normalizeSpendingLimitPeriod(input.period);
      const notifyAt = this.toInteger(input.notifyAt, 80);

      const data: Prisma.SpendingLimitCreateInput = {
        user: { connect: { id: userId } },
        targetType,
        amount,
        period,
        notifyAt,
        isActive: true,
      };

      if (targetType === 'account') {
        const accountId = this.requireString(resolved.accountId, 'accountId');
        data.account = { connect: { id: accountId } };
      }

      if (targetType === 'category') {
        const categoryId = this.requireString(resolved.categoryId, 'categoryId');
        data.category = { connect: { id: categoryId } };
      }

      const limit = await tx.spendingLimit.create({
        data,
        include: {
          account: { select: { id: true, name: true, currency: true, icon: true, color: true } },
          category: { select: { id: true, name: true, type: true, icon: true, color: true } },
        },
      });
      return { tool, limit };
    }

    if (tool === 'update_spending_limit') {
      const limitId = this.requireString(resolved.spendingLimitId, 'spendingLimitId');
      const data: Prisma.SpendingLimitUpdateInput = {};
      if (input.amount !== undefined) data.amount = this.toInteger(input.amount, 0);
      if (input.period !== undefined) data.period = this.normalizeSpendingLimitPeriod(input.period);
      if (input.notifyAt !== undefined) data.notifyAt = this.toInteger(input.notifyAt, 80);
      if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);

      if (input.targetType === 'total') {
        data.targetType = 'total';
        data.account = { disconnect: true };
        data.category = { disconnect: true };
      }

      if (input.targetType === 'account') {
        const accountId = this.requireString(resolved.accountId, 'accountId');
        data.targetType = 'account';
        data.account = { connect: { id: accountId } };
        data.category = { disconnect: true };
      }

      if (input.targetType === 'category') {
        const categoryId = this.requireString(resolved.categoryId, 'categoryId');
        data.targetType = 'category';
        data.category = { connect: { id: categoryId } };
        data.account = { disconnect: true };
      }

      const limit = await tx.spendingLimit.update({
        where: { id: limitId },
        data,
        include: {
          account: { select: { id: true, name: true, currency: true, icon: true, color: true } },
          category: { select: { id: true, name: true, type: true, icon: true, color: true } },
        },
      });
      return { tool, limit };
    }

    if (tool === 'delete_spending_limit') {
      const limitId = this.requireString(resolved.spendingLimitId, 'spendingLimitId');
      const limit = await tx.spendingLimit.findFirst({ where: { id: limitId, userId }, include: { account: true, category: true } });
      if (!limit) throw new NotFoundError('Spending limit not found');
      await tx.spendingLimit.delete({ where: { id: limitId } });
      return { tool, deleted: limit };
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

      const currentAmount = this.toInteger(input.currentAmount, 0);
      const currency = this.cleanString(input.currency).toUpperCase() || 'RUB';
      const accountId = typeof resolved.accountId === 'string'
        ? resolved.accountId
        : await this.createGoalAccount(tx, userId, title, currency, currentAmount);

      const goal = await tx.goal.create({
        data: {
          userId,
          title,
          targetAmount,
          currentAmount,
          currency,
          accountId,
          note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null,
          autoSavePercent: this.toInteger(input.autoSavePercent, 0),
          status: currentAmount >= targetAmount ? 'completed' : 'active',
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
      if (input.autoSavePercent !== null && input.autoSavePercent !== undefined) data.autoSavePercent = Math.max(0, Math.min(100, this.toInteger(input.autoSavePercent, 0)));
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
        tx.userAISettings.upsert({ where: { userId }, create: { userId, autoConfirmExpenseLimit: 5000, autoConfirmIncomeLimit: 200000 }, update: {} }),
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



    if (tool === 'show_obligations') {
      const status = this.cleanString(input.status) || 'active';
      const loans = await tx.loan.findMany({
        where: { userId, ...(status !== 'all' ? { status } : {}) },
        include: {
          account: { select: { id: true, name: true, currency: true, icon: true, color: true } },
          payments: { orderBy: { paidAt: 'desc' }, take: 5 },
          reminders: { where: { status: { in: ['scheduled', 'sent'] } }, orderBy: { remindAt: 'asc' }, take: 3 },
        },
        orderBy: [{ status: 'asc' }, { nextPaymentDate: 'asc' }, { createdAt: 'desc' }],
      });
      const monthlyPaymentTotal = loans.reduce((sum, item) => sum + item.monthlyPayment, 0);
      const totalDebt = loans.reduce((sum, item) => sum + item.currentDebt, 0);
      return { tool, loans, monthlyPaymentTotal, totalDebt };
    }

    if (tool === 'create_obligation') {
      const title = this.cleanString(input.title);
      if (!title) throw new BadRequestError('Obligation title is required');
      const accountId = typeof resolved.accountId === 'string' ? resolved.accountId : null;
      const paymentDay = input.paymentDay === null || input.paymentDay === undefined ? null : this.toInteger(input.paymentDay, 0) || null;
      const nextPaymentDate = this.optionalDate(input.nextPaymentDate) ?? this.nextMonthlyDate(paymentDay);
      const loan = await tx.loan.create({
        data: {
          userId,
          accountId,
          title,
          type: this.cleanString(input.type) || 'loan',
          creditor: this.optionalString(input.creditor),
          currency: this.cleanString(input.currency).toUpperCase() || 'RUB',
          principalAmount: this.toInteger(input.principalAmount, 0),
          currentDebt: this.toInteger(input.currentDebt, this.toInteger(input.principalAmount, 0)),
          monthlyPayment: this.toInteger(input.monthlyPayment, 0),
          interestRate: input.interestRate === null || input.interestRate === undefined ? null : Number(input.interestRate),
          termMonths: input.termMonths === null || input.termMonths === undefined ? null : this.toInteger(input.termMonths, 0) || null,
          paidMonths: this.toInteger(input.paidMonths, 0),
          paymentDay,
          nextPaymentDate,
          reminderDaysBefore: this.toInteger(input.reminderDaysBefore, 1),
          autoCreateExpense: Boolean(input.autoCreateExpense),
          note: this.optionalString(input.note),
          status: 'active',
        },
      });
      await this.rebuildObligationReminder(tx, userId, loan.id);
      return { tool, obligation: loan };
    }

    if (tool === 'update_obligation') {
      const loanId = this.requireString(resolved.loanId, 'loanId');
      const data: Prisma.LoanUpdateInput = {};
      if (input.title !== undefined) data.title = this.cleanString(input.title);
      if (input.type !== undefined) data.type = this.cleanString(input.type) || 'loan';
      if (input.creditor !== undefined) data.creditor = this.optionalString(input.creditor);
      if (input.currency !== undefined) data.currency = this.cleanString(input.currency).toUpperCase() || 'RUB';
      if (input.principalAmount !== undefined) data.principalAmount = this.toInteger(input.principalAmount, 0);
      if (input.currentDebt !== undefined) data.currentDebt = this.toInteger(input.currentDebt, 0);
      if (input.monthlyPayment !== undefined) data.monthlyPayment = this.toInteger(input.monthlyPayment, 0);
      if (input.interestRate !== undefined) data.interestRate = input.interestRate === null ? null : Number(input.interestRate);
      if (input.termMonths !== undefined) data.termMonths = input.termMonths === null ? null : this.toInteger(input.termMonths, 0) || null;
      if (input.paidMonths !== undefined) data.paidMonths = this.toInteger(input.paidMonths, 0);
      const nextPaymentDay = input.paymentDay !== undefined
        ? (input.paymentDay === null ? null : this.toInteger(input.paymentDay, 0) || null)
        : undefined;
      if (input.paymentDay !== undefined) data.paymentDay = nextPaymentDay ?? null;
      if (input.nextPaymentDate !== undefined) data.nextPaymentDate = this.optionalDate(input.nextPaymentDate);
      else if (input.paymentDay !== undefined) data.nextPaymentDate = this.nextMonthlyDate(nextPaymentDay ?? null);
      if (input.reminderDaysBefore !== undefined) data.reminderDaysBefore = this.toInteger(input.reminderDaysBefore, 1);
      if (input.account !== undefined) {
        data.account = typeof resolved.accountId === 'string'
          ? { connect: { id: resolved.accountId } }
          : { disconnect: true };
      }
      if (input.autoCreateExpense !== undefined) data.autoCreateExpense = Boolean(input.autoCreateExpense);
      if (input.status !== undefined) data.status = this.cleanString(input.status) || 'active';
      if (input.note !== undefined) data.note = this.optionalString(input.note);

      const loan = await tx.loan.update({ where: { id: loanId }, data });
      await this.rebuildObligationReminder(tx, userId, loan.id);
      return { tool, obligation: loan };
    }

    if (tool === 'delete_obligation') {
      const loanId = this.requireString(resolved.loanId, 'loanId');
      const loan = await tx.loan.findFirst({ where: { id: loanId, userId } });
      if (!loan) throw new NotFoundError('Obligation not found');
      await tx.loan.delete({ where: { id: loan.id } });
      return { tool, deleted: loan };
    }

    if (tool === 'mark_obligation_paid') {
      const loanId = this.requireString(resolved.loanId, 'loanId');
      const loan = await tx.loan.findFirst({ where: { id: loanId, userId } });
      if (!loan) throw new NotFoundError('Obligation not found');
      const amount = this.toInteger(input.amount, loan.monthlyPayment || loan.currentDebt);
      if (amount <= 0) throw new BadRequestError('Payment amount is required');
      const accountId = typeof resolved.accountId === 'string' ? resolved.accountId : loan.accountId;
      const createExpense = input.createExpense !== undefined ? Boolean(input.createExpense) : loan.autoCreateExpense;
      const paidAt = this.optionalDate(input.paidAt) ?? new Date();
      let transactionId: string | null = null;

      if (createExpense) {
        if (!accountId) throw new BadRequestError('Account is required to create payment expense');
        await this.applyBalanceEffect(tx, { type: 'expense', amount, accountId, direction: 'apply' });
        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId,
            amount,
            type: 'expense',
            description: this.optionalString(input.note) ?? `Платёж: ${loan.title}`,
            date: paidAt,
            isAIGenerated: true,
          },
          include: transactionInclude,
        });
        transactionId = transaction.id;
      }

      const payment = await tx.loanPayment.create({
        data: {
          userId,
          loanId: loan.id,
          accountId: accountId ?? null,
          amount,
          paidAt,
          transactionId,
          note: this.optionalString(input.note),
        },
      });

      const nextDebt = Math.max(0, loan.currentDebt - amount);
      const nextDate = loan.nextPaymentDate ? this.addMonths(loan.nextPaymentDate, 1) : this.nextMonthlyDate(loan.paymentDay);
      const updated = await tx.loan.update({
        where: { id: loan.id },
        data: {
          currentDebt: nextDebt,
          paidMonths: { increment: 1 },
          nextPaymentDate: nextDebt > 0 ? nextDate : null,
          status: nextDebt > 0 ? loan.status : 'closed',
        },
      });
      await tx.obligationReminder.updateMany({ where: { userId, loanId: loan.id, status: 'scheduled' }, data: { status: 'done' } });
      await this.rebuildObligationReminder(tx, userId, loan.id);

      return { tool, payment, obligation: updated, transactionId };
    }

    if (tool === 'create_obligation_reminder') {
      const loanId = typeof resolved.loanId === 'string' ? resolved.loanId : null;
      const title = this.cleanString(input.title) || 'Напоминание';
      const dueDate = this.optionalDate(input.dueDate) ?? new Date();
      const remindAt = this.optionalDate(input.remindAt) ?? dueDate;
      const reminder = await tx.obligationReminder.create({
        data: {
          userId,
          loanId,
          title,
          message: this.optionalString(input.message) ?? title,
          dueDate,
          remindAt,
          channel: this.cleanString(input.channel) || 'app',
          status: 'scheduled',
        },
      });
      return { tool, reminder };
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

    const onlyCreatedId = this.getOnlyCreatedAccountId(createdAccountNames);
    if (onlyCreatedId) return onlyCreatedId;

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
    const appearance = resolveSectionAppearance(name);
    if (existing) {
      if (shouldReplaceGenericIcon(existing.icon) || !existing.color) {
        const updated = await tx.section.update({
          where: { id: existing.id },
          data: {
            icon: shouldReplaceGenericIcon(existing.icon) ? appearance.icon : existing.icon,
            color: existing.color ?? appearance.color,
          },
        });
        return updated.id;
      }
      return existing.id;
    }

    const created = await tx.section.create({
      data: {
        userId,
        name,
        icon: appearance.icon,
        color: appearance.color,
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
    const appearance = resolveCategoryAppearance(name, params.type);
    if (existing) {
      if (shouldReplaceGenericIcon(existing.icon) || !existing.color || existing.sectionId) {
        const updated = await tx.category.update({
          where: { id: existing.id },
          data: {
            icon: shouldReplaceGenericIcon(existing.icon) ? appearance.categoryIcon : existing.icon,
            color: existing.color ?? appearance.categoryColor,
            sectionId: null,
          },
        });
        return updated.id;
      }
      return existing.id;
    }

    const created = await tx.category.create({
      data: {
        userId,
        name,
        type: params.type,
        icon: appearance.categoryIcon,
        color: appearance.categoryColor,
        sectionId: null,
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

  private async resolveAccountIdForAction(
    tx: Prisma.TransactionClient,
    userId: string,
    input: Record<string, unknown>,
    resolved: Record<string, unknown>,
    createdAccountNames: Map<string, string>,
    fieldName: string,
  ) {
    if (typeof resolved.accountId === 'string' && resolved.accountId.trim()) return resolved.accountId;

    const accountRef = this.cleanString(input.account || input.accountName || input.name);
    if (accountRef) {
      const createdId = createdAccountNames.get(this.key(accountRef));
      if (createdId) return createdId;

      const account = await this.resolveAccount(tx, userId, accountRef);
      if (account) return account.id;
    }

    const onlyCreatedId = this.getOnlyCreatedAccountId(createdAccountNames);
    if (onlyCreatedId) return onlyCreatedId;

    return this.requireString(resolved.accountId, fieldName);
  }


  private async createGoalAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    title: string,
    currency: string,
    balance: number,
  ) {
    const baseName = `Цель: ${this.cleanString(title).slice(0, 48) || 'Цель'}`;
    let name = baseName;

    for (let index = 0; index < 20; index += 1) {
      const candidate = index === 0 ? baseName : `${baseName} ${index + 1}`;
      const existing = await tx.account.findFirst({ where: { userId, name: candidate }, select: { id: true } });
      if (!existing) {
        name = candidate;
        break;
      }
    }

    const account = await tx.account.create({
      data: {
        userId,
        name,
        type: 'savings',
        currency,
        balance,
        openingBalance: balance,
        showInTotalBalance: true,
        icon: '🎯',
        color: '#22c55e',
      },
      select: { id: true },
    });

    return account.id;
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
    const queryParts = this.accountQueryParts(ref);

    return accounts.find((account) => account.id === raw)
      ?? accounts.find((account) => this.accountAliases(account).some((alias) => alias === ref || queryParts.includes(alias)))
      ?? accounts.find((account) => this.accountAliases(account).some((alias) => alias.includes(ref) || ref.includes(alias) || queryParts.some((part) => alias.includes(part) || part.includes(alias))))
      ?? null;
  }

  private accountQueryParts(value: string) {
    const stopWords = new Set(['используй', 'использовать', 'выбери', 'возьми', 'счет', 'счёт', 'со', 'с', 'на', 'из', 'для']);
    return value.split(' ').filter((word) => word && !stopWords.has(word));
  }

  private accountAliases(account: { name: string; type?: string | null }) {
    const base = this.key(account.name);
    const type = this.key(account.type ?? '');
    const aliases = new Set([base, ...base.split(' ').filter((word) => word.length >= 2)]);

    if (type === 'cash' || base.includes('налич') || base.includes('налик') || base.includes('cash')) {
      ['наличные', 'наличка', 'наличку', 'налик', 'кэш', 'cash'].forEach((alias) => aliases.add(this.key(alias)));
    }

    if (type === 'card' || base.includes('карта') || base.includes('банк') || base.includes('сбер') || base.includes('тинькофф')) {
      ['карта', 'карту', 'карточка', 'банк'].forEach((alias) => aliases.add(this.key(alias)));
    }

    if (type === 'savings' || base.includes('цель') || base.includes('копил') || base.includes('накоп')) {
      ['цель', 'копилка', 'копилку', 'накопления'].forEach((alias) => aliases.add(this.key(alias)));
    }

    return Array.from(aliases).filter(Boolean);
  }

  private rememberAccount(map: Map<string, string>, name: string, id: string) {
    const key = this.key(name);
    if (key) map.set(key, id);
  }

  private rememberLastCreatedAccount(map: Map<string, string>, id: string) {
    map.set('__last_created_account__', id);
  }

  private getOnlyCreatedAccountId(map: Map<string, string>) {
    const ids = Array.from(new Set(Array.from(map.entries())
      .filter(([key]) => key !== '__last_created_account__')
      .map(([, id]) => id)
      .filter(Boolean)));

    if (ids.length === 1) return ids[0];
    return map.get('__last_created_account__') ?? '';
  }

  private key(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/счета/g, 'счет')
      .replace(/счёта/g, 'счет')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }


  private normalizeSpendingLimitPeriod(value: unknown) {
    const raw = this.cleanString(value).toLowerCase();
    if (raw === 'daily' || raw === 'day' || raw === 'день' || raw === 'дневной') return 'daily';
    if (raw === 'weekly' || raw === 'week' || raw === 'неделя' || raw === 'недельный') return 'weekly';
    return 'monthly';
  }

  private toInteger(value: unknown, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
    return parsed;
  }

  private safeDate(value: string, fallback: Date) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : fallback;
  }


  private optionalString(value: unknown) {
    if (value === undefined || value === null) return null;
    const text = this.cleanString(value);
    return text || null;
  }

  private optionalDate(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private addMonths(date: Date, months: number) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  }

  private nextMonthlyDate(paymentDay?: number | null) {
    if (!paymentDay) return null;
    const now = new Date();
    const day = Math.min(paymentDay, 28);
    const next = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0, 0);
    if (next.getTime() < now.getTime()) next.setMonth(next.getMonth() + 1);
    return next;
  }

  private reminderDate(dueDate: Date, daysBefore: number) {
    const remindAt = new Date(dueDate);
    remindAt.setDate(remindAt.getDate() - daysBefore);
    remindAt.setHours(9, 0, 0, 0);
    return remindAt;
  }

  private async rebuildObligationReminder(tx: Prisma.TransactionClient, userId: string, loanId: string) {
    const loan = await tx.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) return;

    await tx.obligationReminder.updateMany({
      where: { userId, loanId, status: 'scheduled' },
      data: { status: 'cancelled' },
    });

    if (loan.status !== 'active' || !loan.nextPaymentDate || loan.monthlyPayment <= 0) return;

    await tx.obligationReminder.create({
      data: {
        userId,
        loanId,
        title: `Платёж: ${loan.title}`,
        message: `Платёж ${loan.monthlyPayment} ${loan.currency} по обязательству «${loan.title}»`,
        dueDate: loan.nextPaymentDate,
        remindAt: this.reminderDate(loan.nextPaymentDate, loan.reminderDaysBefore),
        channel: 'app',
        status: 'scheduled',
      },
    });
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
        autoConfirmExpenseLimit: 5000,
        autoConfirmIncomeLimit: 250000,
        autoConfirmTransferLimit: 0,
        requireConfirmForAccountActions: true,
        companionTone: 'coach',
      };
    }

    return {
      autoConfirmExpenseLimit: 5000,
      autoConfirmIncomeLimit: 200000,
      autoConfirmTransferLimit: 0,
      requireConfirmForAccountActions: true,
      companionTone: 'friendly',
    };
  }

  private async deleteAccountsByIds(tx: Prisma.TransactionClient, userId: string, accountIds: string[]) {
    const uniqueIds = Array.from(new Set(accountIds));
    const accounts = await tx.account.findMany({ where: { userId, id: { in: uniqueIds } } });

    if (accounts.length === 0) throw new NotFoundError('Accounts not found');

    const linkedTransactions = await tx.transaction.findMany({
      where: {
        userId,
        OR: [{ accountId: { in: uniqueIds } }, { toAccountId: { in: uniqueIds } }],
      },
      select: { id: true, type: true, amount: true, accountId: true, toAccountId: true, goalId: true },
    });
    const transactionIds = linkedTransactions.map((item) => item.id);
    const deletedAccountIds = new Set(uniqueIds);

    for (const transaction of linkedTransactions) {
      if (transaction.type !== 'transfer') continue;

      if (deletedAccountIds.has(transaction.accountId) && transaction.toAccountId && !deletedAccountIds.has(transaction.toAccountId)) {
        await tx.account.updateMany({
          where: { userId, id: transaction.toAccountId },
          data: { balance: { decrement: transaction.amount } },
        });
      }

      if (transaction.toAccountId && deletedAccountIds.has(transaction.toAccountId) && !deletedAccountIds.has(transaction.accountId)) {
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
          { defaultExpenseAccountId: { in: uniqueIds } },
          { defaultIncomeAccountId: { in: uniqueIds } },
        ],
      },
      data: { defaultExpenseAccountId: null, defaultIncomeAccountId: null },
    });

    await tx.goal.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
    await tx.loan.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
    await tx.loanPayment.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
    await tx.recurringPaymentPayment.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
    await tx.receiptScan.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });

    if (transactionIds.length > 0) {
      await tx.loanPayment.updateMany({ where: { userId, transactionId: { in: transactionIds } }, data: { transactionId: null } });
      await tx.recurringPaymentPayment.updateMany({ where: { userId, transactionId: { in: transactionIds } }, data: { transactionId: null } });
      await tx.receiptScan.updateMany({ where: { userId, transactionId: { in: transactionIds } }, data: { transactionId: null } });
      await tx.transaction.deleteMany({ where: { userId, id: { in: transactionIds } } });
    }

    await tx.recurringPayment.deleteMany({ where: { userId, accountId: { in: uniqueIds } } });
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
