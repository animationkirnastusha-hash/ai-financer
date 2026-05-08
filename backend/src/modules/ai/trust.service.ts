import { AIManager } from './manager';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { AIHandleOptions, AIParsedCommand, AIParsedAtomicCommand, AIResult } from './types';

const aiManager = new AIManager();
const auditService = new AIAuditService();
const pendingActionService = new AIPendingActionService();

function parseStoredJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizePendingAction(intent: string, payload: Record<string, unknown>): AIParsedCommand {
  if (intent === 'batch' || Array.isArray(payload.actions)) {
    const actions = Array.isArray(payload.actions)
      ? payload.actions.map((item) => normalizePendingAction(asString(asRecord(item).intent || asRecord(item).type, 'unknown'), asRecord(item)))
      : [];

    return {
      intent: 'batch',
      actions: actions.filter((item): item is AIParsedAtomicCommand => item.intent !== 'batch' && item.intent !== 'unknown'),
      originalText: asString(payload.originalText),
    };
  }

  if (intent === 'create_account') {
    return {
      intent: 'create_account',
      name: asString(payload.name || payload.accountName, 'Новый счёт'),
      type: asString(payload.type, 'card'),
      currency: asString(payload.currency, 'RUB').toUpperCase(),
      balance: asNumber(payload.balance || payload.initialBalance, 0),
    };
  }

  if (intent === 'income' || intent === 'expense' || payload.type === 'income' || payload.type === 'expense') {
    const type = intent === 'income' || payload.type === 'income' ? 'income' : 'expense';
    return {
      intent: type,
      amount: asNumber(payload.amount, 0),
      rawCategory: asString(payload.rawCategory || payload.categoryName || payload.category || payload.description, type === 'income' ? 'пополнение' : 'расход'),
      description: asString(payload.description || payload.rawCategory || payload.categoryName, type === 'income' ? 'пополнение' : 'расход'),
      accountName: asString(payload.accountName || payload.account, ''),
      sectionName: asString(payload.sectionName || payload.section, ''),
    };
  }

  if (intent === 'transfer' || payload.type === 'transfer') {
    return {
      intent: 'transfer',
      amount: asNumber(payload.amount, 0),
      fromAccountName: asString(payload.fromAccountName || payload.accountName, ''),
      toAccountName: asString(payload.toAccountName || payload.accountName || payload.to, ''),
    };
  }

  if (intent === 'create_category') {
    return {
      intent: 'create_category',
      name: asString(payload.name || payload.categoryName, 'Новая категория'),
      type: payload.type === 'income' ? 'income' : 'expense',
      sectionName: asString(payload.sectionName, ''),
    };
  }

  if (intent === 'create_section') {
    return { intent: 'create_section', name: asString(payload.name || payload.sectionName, 'Новый раздел') };
  }

  if (intent === 'assign_expenses_to_section') {
    return {
      intent: 'assign_expenses_to_section',
      rawQuery: asString(payload.rawQuery || payload.category || payload.description, ''),
      sectionName: asString(payload.sectionName || payload.name, ''),
    };
  }

  return { intent: 'unknown' };
}

function enrichUndoMeta(result: AIResult): AIResult {
  const transactionLikeIntent =
    result.intent === 'expense' || result.intent === 'income' || result.intent === 'transfer';

  const data = result.data as { id?: string } | undefined;

  if (result.executed && transactionLikeIntent && data?.id) {
    result.meta = {
      ...(result.meta ?? {}),
      undo: {
        available: true,
        actionType: 'transaction',
        targetId: data.id,
      },
    };
  }

  return result;
}

export class AITrustService {
  async handleCommand(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    try {
      const result = enrichUndoMeta(await aiManager.handle(userId, command, options));

      const status = result.executed
        ? 'executed'
        : result.requiresConfirmation
        ? 'pending_confirmation'
        : 'previewed';

      const auditLog = await auditService.logSuccess(userId, command, result, status);

      result.meta = {
        ...(result.meta ?? {}),
        auditLogId: auditLog.id,
      };

      if (result.requiresConfirmation && !result.executed) {
        const pendingAction = await pendingActionService.createPendingAction({
          userId,
          command,
          intent: result.intent,
          riskLevel: result.riskLevel,
          parsed: result.parsed,
        });

        result.meta = {
          ...(result.meta ?? {}),
          pendingActionId: pendingAction.id,
          confirmExpiresAt: pendingAction.expiresAt.toISOString(),
        };
      }

      return result;
    } catch (error) {
      await auditService.logFailure(userId, command, error);
      throw error;
    }
  }

  async confirmCommand(userId: string, pendingActionId: string, parsedOverride?: Record<string, unknown>): Promise<AIResult> {
    const pendingAction = await pendingActionService.getPendingAction(userId, pendingActionId);

    const overrideSource = parsedOverride && Object.keys(parsedOverride).length > 0 ? parsedOverride : null;

    const result = enrichUndoMeta(
      overrideSource
        ? await aiManager.executeConfirmedParsed(userId, normalizePendingAction(pendingAction.intent, overrideSource))
        : await aiManager.handle(userId, pendingAction.command, {
            execute: true,
            confirmed: true,
          })
    );

    await pendingActionService.confirmPendingAction(pendingAction.id);

    const auditLog = await auditService.logSuccess(
      userId,
      pendingAction.command,
      result,
      result.executed ? 'executed' : 'previewed'
    );

    result.meta = {
      ...(result.meta ?? {}),
      auditLogId: auditLog.id,
      pendingActionId: pendingAction.id,
    };

    return result;
  }


  async updatePendingAction(
    userId: string,
    pendingActionId: string,
    parsed: Record<string, unknown>,
    command?: string,
  ) {
    const updated = await pendingActionService.updatePendingAction(userId, pendingActionId, {
      parsed,
      command,
    });

    return {
      success: true,
      intent: updated.intent as AIResult['intent'],
      executed: false,
      requiresConfirmation: true,
      riskLevel: updated.riskLevel as AIResult['riskLevel'],
      message: 'AI-действие обновлено. Проверь и подтверди выполнение.',
      parsed,
      meta: {
        pendingActionId: updated.id,
        confirmExpiresAt: updated.expiresAt.toISOString(),
      },
    } satisfies AIResult;
  }

  async cancelCommand(userId: string, pendingActionId: string) {
    const pendingAction = await pendingActionService.getPendingAction(userId, pendingActionId);

    await pendingActionService.cancelPendingAction(pendingAction.id);

    const parsed = parseStoredJson(pendingAction.parsed);

    const auditLog = await auditService.createLog({
      userId,
      command: pendingAction.command,
      intent: pendingAction.intent,
      riskLevel: pendingAction.riskLevel,
      requiresConfirmation: true,
      executed: false,
      status: 'cancelled',
      parsed,
      result: null,
    });

    return {
      success: true,
      intent: pendingAction.intent as AIResult['intent'],
      executed: false,
      requiresConfirmation: false,
      riskLevel: pendingAction.riskLevel as AIResult['riskLevel'],
      message: '❌ AI-действие отменено.',
      parsed,
      meta: {
        auditLogId: auditLog.id,
        pendingActionId: pendingAction.id,
      },
    } satisfies AIResult;
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return pendingActionService.getPendingActions(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return auditService.getAuditLogs(userId, limit);
  }
}