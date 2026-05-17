import { AIParsedCommand, AIValidatedAction } from '../ai/types';
import { progressionService } from './service';
import type { ActivityType } from './types';

type ExecutionResult = {
  tool?: string;
  skipped?: boolean;
  reason?: string;
  account?: { id?: string; name?: string; type?: string; balance?: number };
  category?: { id?: string; name?: string; type?: string };
  section?: { id?: string; name?: string };
  budget?: { id?: string; amount?: number };
  transaction?: {
    id?: string;
    type?: string;
    amount?: number;
    accountId?: string;
    toAccountId?: string | null;
    description?: string | null;
  };
};

export class ProgressionActivityBridge {
  async trackAIExecution(userId: string, parsed: AIParsedCommand, results: unknown[]) {
    const mutationActions = parsed.actions.filter((action) => !this.isReadOnlyAction(action.tool));
    if (mutationActions.length === 0) return;

    await this.safeTrack(userId, 'ai_action_confirmed', {
      summary: parsed.summary,
      actionsCount: mutationActions.length,
      tools: mutationActions.map((action) => action.tool),
    });

    for (let index = 0; index < mutationActions.length; index += 1) {
      const action = mutationActions[index];
      const result = this.asResult(results[index]);
      if (result?.skipped) continue;

      const type = this.activityForAIAction(action, result);
      if (!type) continue;

      await this.safeTrack(userId, type, {
        source: 'ai',
        tool: action.tool,
        input: this.compact(action.input),
        result: this.compactResult(result),
      });
    }
  }

  async trackManualTransaction(userId: string, transaction: { id: string; type: string; amount: number; accountId: string; toAccountId?: string | null }) {
    const type = this.activityForTransactionType(transaction.type);
    if (!type) return;

    await this.safeTrack(userId, type, {
      source: 'manual',
      transactionId: transaction.id,
      transactionType: transaction.type,
      amount: transaction.amount,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId ?? null,
    });
  }

  async trackAccountCreated(userId: string, account: { id: string; name: string; type: string; currency: string; balance: number }) {
    await this.safeTrack(userId, 'account_created', {
      source: 'manual',
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
    });
  }

  async trackCategoryCreated(userId: string, category: { id: string; name: string; type: string }) {
    await this.safeTrack(userId, 'category_created', {
      source: 'manual',
      categoryId: category.id,
      name: category.name,
      type: category.type,
    });
  }

  async trackSectionCreated(userId: string, section: { id: string; name: string }) {
    await this.safeTrack(userId, 'section_created', {
      source: 'manual',
      sectionId: section.id,
      name: section.name,
    });
  }

  async trackBudgetCreated(userId: string, budget: { id: string; amount: number; categoryId: string; period: string }) {
    await this.safeTrack(userId, 'budget_created', {
      source: 'manual',
      budgetId: budget.id,
      amount: budget.amount,
      categoryId: budget.categoryId,
      period: budget.period,
    });
  }

  private async safeTrack(userId: string, type: ActivityType, payload: unknown) {
    try {
      await progressionService.trackActivity(userId, type, payload);
    } catch (error) {
      console.error('[PROGRESSION] activity tracking failed', {
        userId,
        type,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private activityForAIAction(action: AIValidatedAction, result: ExecutionResult | null): ActivityType | null {
    if (action.tool === 'create_account') return 'account_created';
    if (action.tool === 'create_category') return 'category_created';
    if (action.tool === 'create_section') return 'section_created';
    if (action.tool === 'transfer_money') return 'transfer_created';

    if (action.tool === 'create_transaction') {
      const resultType = result?.transaction?.type;
      const inputKind = typeof action.input.kind === 'string' ? action.input.kind : '';
      return this.activityForTransactionType(resultType || inputKind);
    }

    return null;
  }

  private activityForTransactionType(value: string | undefined | null): ActivityType | null {
    if (value === 'income') return 'income_created';
    if (value === 'expense') return 'expense_created';
    if (value === 'transfer') return 'transfer_created';
    return null;
  }

  private isReadOnlyAction(tool: string) {
    return tool === 'show_accounts' || tool === 'show_transactions';
  }

  private asResult(value: unknown): ExecutionResult | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as ExecutionResult
      : null;
  }

  private compact(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of ['kind', 'amount', 'currency', 'account', 'category', 'description', 'name', 'type']) {
      if (record[key] !== undefined) result[key] = record[key];
    }

    return result;
  }

  private compactResult(result: ExecutionResult | null) {
    if (!result) return null;

    return {
      tool: result.tool,
      skipped: result.skipped ?? false,
      reason: result.reason,
      accountId: result.account?.id,
      transactionId: result.transaction?.id,
      categoryId: result.category?.id,
      sectionId: result.section?.id,
      amount: result.transaction?.amount,
      transactionType: result.transaction?.type,
    };
  }
}

export const progressionActivityBridge = new ProgressionActivityBridge();
