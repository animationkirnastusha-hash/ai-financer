import { BadRequestError } from '../../shared/core/errors';
import { AIContextService } from './ai-context.service';
import { AIExecutorService } from './ai-executor.service';
import { AIPlannerService } from './ai-planner.service';
import { AIPreviewService } from './ai-preview.service';
import { AIValidatorService } from './ai-validator.service';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { AIHandleOptions, AIParsedCommand, AIResult, AIRiskLevel } from './types';

export class AIOrchestratorService {
  private readonly context = new AIContextService();
  private readonly planner = new AIPlannerService();
  private readonly validator = new AIValidatorService();
  private readonly preview = new AIPreviewService();
  private readonly executor = new AIExecutorService();
  private readonly pending = new AIPendingActionService();
  private readonly audit = new AIAuditService();

  async handleCommand(userId: string, command: string, _options: AIHandleOptions = {}): Promise<AIResult> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('command is required');

    try {
      const context = await this.context.buildUserContext(userId);
      const plan = await this.planner.plan(trimmed, context);

      if (!plan.actions.length) {
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'no_action',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'no_action',
          result: { plan },
        });

        return {
          success: false,
          intent: 'no_action',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: 'Не нашёл действие для выполнения. Сформулируй как действие: сумма, счёт, тип операции.',
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      const validated = await this.validator.validate(userId, plan);
      const parsed = this.preview.buildParsed(validated.summary, validated.actions);

      if (!validated.ok) {
        const message = validated.issues.map((issue) => issue.message).join('\n') || 'Не удалось безопасно подготовить действие.';
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'validation_failed',
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: false,
          status: 'validation_failed',
          parsed,
          errorMessage: message,
        });

        return {
          success: false,
          intent: 'validation_failed',
          executed: false,
          requiresConfirmation: false,
          riskLevel: validated.riskLevel,
          message,
          parsed: parsed as unknown as Record<string, unknown>,
          meta: { auditLogId: audit.id },
        };
      }

      if (!validated.requiresConfirmation) {
        const result = await this.executor.execute(userId, parsed);
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: parsed.intent,
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: true,
          status: 'executed',
          parsed,
          result,
        });

        return {
          success: true,
          intent: parsed.intent,
          executed: true,
          requiresConfirmation: false,
          riskLevel: validated.riskLevel,
          message: this.preview.buildExecutedMessage(parsed),
          parsed: parsed as unknown as Record<string, unknown>,
          result,
          meta: { auditLogId: audit.id, undo: { available: false } },
        };
      }

      const pending = await this.pending.create({ userId, command: trimmed, parsed, riskLevel: validated.riskLevel });

      const audit = await this.audit.create({
        userId,
        command: trimmed,
        intent: parsed.intent,
        riskLevel: validated.riskLevel,
        requiresConfirmation: true,
        executed: false,
        status: 'pending_confirmation',
        parsed,
      });

      return {
        success: true,
        intent: parsed.intent,
        executed: false,
        requiresConfirmation: true,
        riskLevel: validated.riskLevel,
        message: this.preview.buildMessage(parsed),
        parsed: parsed as unknown as Record<string, unknown>,
        meta: { auditLogId: audit.id, pendingActionId: pending.id },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Core failed';
      console.error('[AI] handleCommand failed', { message, command: trimmed });
      const audit = await this.audit.create({
        userId,
        command: trimmed,
        intent: 'error',
        riskLevel: 'low',
        requiresConfirmation: false,
        executed: false,
        status: 'error',
        errorMessage: message,
      });

      return {
        success: false,
        intent: 'error',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: 'AI Core не смог подготовить действие. Повтори коротко: действие, сумма, счёт.',
        parsed: null,
        meta: { auditLogId: audit.id },
      };
    }
  }

  async confirmCommand(userId: string, pendingActionId: string): Promise<AIResult> {
    const startedAt = Date.now();
    let pending: Awaited<ReturnType<AIPendingActionService['getForConfirm']>> | null = null;
    let parsed: AIParsedCommand | null = null;

    try {
      pending = await this.pending.getForConfirm(userId, pendingActionId);
      parsed = pending.parsed as unknown as AIParsedCommand | null;

      if (!parsed || parsed.intent !== 'batch' || !Array.isArray(parsed.actions)) {
        throw new BadRequestError('Invalid pending action payload');
      }

      const result = await this.executor.execute(userId, parsed, { pendingActionId });

      const riskLevel = this.normalizeRisk(pending.riskLevel);
      const audit = await this.audit.create({
        userId,
        command: pending.command,
        intent: parsed.intent,
        riskLevel,
        requiresConfirmation: true,
        executed: true,
        status: 'executed',
        parsed,
        result: {
          ...this.asResultObject(result),
          lifecycle: 'pending_confirmed',
          confirmElapsedMs: Date.now() - startedAt,
        },
      });

      return {
        success: true,
        intent: parsed.intent,
        executed: true,
        requiresConfirmation: false,
        riskLevel,
        message: this.preview.buildExecutedMessage(parsed),
        parsed: parsed as unknown as Record<string, unknown>,
        result,
        meta: { auditLogId: audit.id, undo: { available: false } },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Confirm failed';
      console.error('[AI] confirmCommand failed', { message, pendingActionId });

      if (pendingActionId) {
        await this.pending.markFailed(userId, pendingActionId, message).catch(() => null);
      }

      const riskLevel = pending ? this.normalizeRisk(pending.riskLevel) : 'low';
      const audit = await this.audit.create({
        userId,
        command: pending?.command ?? '',
        intent: parsed?.intent ?? pending?.intent ?? 'confirm_error',
        riskLevel,
        requiresConfirmation: true,
        executed: false,
        status: 'confirm_failed',
        parsed: parsed ?? pending?.parsed ?? { pendingActionId },
        errorMessage: message,
        result: { pendingActionId, confirmElapsedMs: Date.now() - startedAt },
      });

      return {
        success: false,
        intent: parsed?.intent ?? 'confirm_error',
        executed: false,
        requiresConfirmation: false,
        riskLevel,
        message: 'Не удалось выполнить подтверждённое действие. Оно помечено как failed, чтобы не выполнить его повторно.',
        parsed: parsed as unknown as Record<string, unknown> | null,
        meta: { auditLogId: audit.id },
      };
    }
  }

  async updatePendingAction(userId: string, pendingActionId: string, parsed: Record<string, unknown>, command?: string) {
    return this.pending.update(userId, pendingActionId, parsed, command);
  }

  async cancelCommand(userId: string, pendingActionId: string) {
    const pending = await this.pending.cancel(userId, pendingActionId);
    return {
      success: true,
      intent: pending.intent,
      executed: false,
      requiresConfirmation: false,
      riskLevel: this.normalizeRisk(pending.riskLevel),
      message: 'Действие отменено.',
      parsed: pending.parsed,
    } satisfies AIResult;
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return this.pending.list(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return this.audit.list(userId, limit);
  }

  private asResultObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : { value };
  }

  private normalizeRisk(value: unknown): AIRiskLevel {
    return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
  }
}
