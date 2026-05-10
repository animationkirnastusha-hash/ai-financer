import { AIManager } from './manager';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';

const aiManager = new AIManager();
const auditService = new AIAuditService();
const pendingActionService = new AIPendingActionService();

type AccountType = 'cash' | 'card' | 'savings' | 'investment';

function normalizeAccountType(value: unknown): AccountType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'card' || raw.includes('карт') || raw.includes('банк') || raw.includes('безнал')) return 'card';
  if (raw === 'savings' || raw.includes('накоп') || raw.includes('сбереж') || raw.includes('копил')) return 'savings';
  if (raw === 'investment' || raw.includes('инвест') || raw.includes('брокер')) return 'investment';
  return 'cash';
}

function parseStoredJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeStoredParsed(intent: string, parsed: Record<string, unknown> | null): AIParsedCommand | null {
  if (!parsed) return null;

  const normalizedIntent = asString(parsed.intent || parsed.type || intent, intent) as AIParsedCommand['intent'];

  if (normalizedIntent === 'batch') {
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .map((item) => normalizeStoredParsed(asString((item as any)?.intent || (item as any)?.type, ''), item as Record<string, unknown>))
          .filter((item): item is Exclude<AIParsedCommand, { intent: 'batch' }> => Boolean(item && item.intent !== 'batch'))
      : [];

    if (actions.length === 0) return null;
    return { intent: 'batch', actions, originalText: asString(parsed.originalText), premiumSuggestion: asString(parsed.premiumSuggestion) || undefined };
  }

  if (normalizedIntent === 'create_account') {
    return {
      intent: 'create_account',
      name: asString(parsed.name || parsed.accountName, 'Новый счёт'),
      type: normalizeAccountType(parsed.type),
      currency: asString(parsed.currency, 'RUB').toUpperCase(),
      balance: asNumber(parsed.balance, 0),
    };
  }

  if (normalizedIntent === 'income' || normalizedIntent === 'expense') {
    return {
      intent: normalizedIntent,
      amount: asNumber(parsed.amount),
      currency: asString(parsed.currency) || undefined,
      rawCategory: asString(parsed.rawCategory || parsed.category || parsed.categoryName || parsed.description, normalizedIntent === 'income' ? 'доход' : 'расход'),
      description: asString(parsed.description || parsed.rawCategory || parsed.category || parsed.categoryName, normalizedIntent === 'income' ? 'доход' : 'расход'),
      accountName: asString(parsed.accountName) || undefined,
      sectionName: asString(parsed.sectionName) || undefined,
    };
  }

  if (normalizedIntent === 'transfer') {
    return {
      intent: 'transfer',
      amount: asNumber(parsed.amount),
      fromAccountName: asString(parsed.fromAccountName) || undefined,
      toAccountName: asString(parsed.toAccountName || parsed.accountName),
    };
  }

  if (normalizedIntent === 'create_section') return { intent: 'create_section', name: asString(parsed.name, 'Новый раздел') };

  if (normalizedIntent === 'create_category') {
    return {
      intent: 'create_category',
      name: asString(parsed.name || parsed.categoryName, 'Новая категория'),
      type: asString(parsed.type, 'expense') === 'income' ? 'income' : 'expense',
      sectionName: asString(parsed.sectionName) || undefined,
    };
  }

  if (normalizedIntent === 'assign_expenses_to_section') {
    return { intent: 'assign_expenses_to_section', rawQuery: asString(parsed.rawQuery), sectionName: asString(parsed.sectionName) };
  }

  return null;
}

function readUndoTargetId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.id === 'string' ? record.id : undefined;
}

function resolveUndoActionType(intent: AIResult['intent']): NonNullable<NonNullable<AIResult['meta']>['undo']>['actionType'] | undefined {
  if (intent === 'expense' || intent === 'income' || intent === 'transfer') return 'transaction';
  if (intent === 'create_account') return 'account';
  if (intent === 'create_category') return 'category';
  if (intent === 'create_section') return 'section';
  if (intent === 'batch') return 'batch';
  return undefined;
}

function enrichUndoMeta(result: AIResult): AIResult {
  if (!result.executed) return result;

  const actionType = resolveUndoActionType(result.intent);
  if (!actionType) return result;

  const targetId = actionType === 'batch' ? undefined : readUndoTargetId(result.data);

  if (actionType !== 'batch' && !targetId) return result;

  result.meta = {
    ...(result.meta ?? {}),
    undo: {
      available: true,
      actionType,
      targetId,
    },
  };

  return result;
}

export class AITrustService {
  async handleCommand(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    try {
      const result = enrichUndoMeta(await aiManager.handle(userId, command, options));
      const status = result.executed ? 'executed' : result.requiresConfirmation ? 'pending_confirmation' : 'previewed';
      const auditLog = await auditService.logSuccess(userId, command, result, status);

      result.meta = { ...(result.meta ?? {}), auditLogId: auditLog.id };

      if (result.requiresConfirmation && !result.executed) {
        const pendingAction = await pendingActionService.createPendingAction({ userId, command, intent: result.intent, riskLevel: result.riskLevel, parsed: result.parsed });
        result.meta = { ...(result.meta ?? {}), pendingActionId: pendingAction.id, confirmExpiresAt: pendingAction.expiresAt.toISOString() };
      }

      return result;
    } catch (error) {
      await auditService.logFailure(userId, command, error);
      throw error;
    }
  }

  async confirmCommand(userId: string, pendingActionId: string): Promise<AIResult> {
    const pendingAction = await pendingActionService.getPendingAction(userId, pendingActionId);
    const parsed = parseStoredJson(pendingAction.parsed);
    const parsedCommand = normalizeStoredParsed(pendingAction.intent, parsed);

    const result = enrichUndoMeta(
      parsedCommand
        ? await aiManager.executeParsed(userId, pendingAction.command, parsedCommand)
        : await aiManager.handle(userId, pendingAction.command, { execute: true, confirmed: true })
    );

    await pendingActionService.confirmPendingAction(pendingAction.id);

    const auditLog = await auditService.logSuccess(userId, pendingAction.command, result, result.executed ? 'executed' : 'previewed');
    result.meta = { ...(result.meta ?? {}), auditLogId: auditLog.id, pendingActionId: pendingAction.id };

    return result;
  }

  async updatePendingAction(userId: string, pendingActionId: string, params: { parsed?: Record<string, unknown> | null; command?: string }) {
    const action = await pendingActionService.updatePendingAction(userId, pendingActionId, params);
    const parsed = parseStoredJson(action.parsed);

    return {
      id: action.id,
      command: action.command,
      intent: action.intent,
      riskLevel: action.riskLevel,
      status: action.status,
      parsed,
      expiresAt: action.expiresAt.toISOString(),
      confirmedAt: action.confirmedAt ? action.confirmedAt.toISOString() : null,
      cancelledAt: action.cancelledAt ? action.cancelledAt.toISOString() : null,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    };
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
      meta: { auditLogId: auditLog.id, pendingActionId: pendingAction.id },
    } satisfies AIResult;
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return pendingActionService.getPendingActions(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return auditService.getAuditLogs(userId, limit);
  }
}
