import { AIManager } from './manager';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';

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

  async confirmCommand(userId: string, pendingActionId: string): Promise<AIResult> {
    const pendingAction = await pendingActionService.getPendingAction(userId, pendingActionId);
    const storedParsed = parseStoredJson(pendingAction.parsed) as AIParsedCommand | null;

    const result = enrichUndoMeta(
      storedParsed
        ? await aiManager.executeParsed(
            userId,
            pendingAction.command,
            storedParsed,
            pendingAction.riskLevel as AIResult['riskLevel'],
          )
        : await aiManager.handle(userId, pendingAction.command, {
            execute: true,
            confirmed: true,
          }),
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

  async updatePendingAction(userId: string, pendingActionId: string, parsed: Record<string, unknown>, command?: string) {
    const updated = await pendingActionService.updatePendingAction(userId, pendingActionId, { parsed, command });
    return {
      success: true,
      pendingAction: {
        id: updated.id,
        command: updated.command,
        intent: updated.intent,
        riskLevel: updated.riskLevel,
        status: updated.status,
        parsed: parseStoredJson(updated.parsed),
        expiresAt: updated.expiresAt.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
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