import { BadRequestError } from '../../shared/core/errors';
import { AIAnswerService } from './ai-answer.service';
import { AIContextService } from './ai-context.service';
import { AIExecutorService } from './ai-executor.service';
import { AIPlannerService } from './ai-planner.service';
import { AIModelRouter } from './ai-model-router';
import { AIPreviewService } from './ai-preview.service';
import { AIValidatorService } from './ai-validator.service';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { AIHandleOptions, AIParsedCommand, AIResult, AIRiskLevel } from './types';

export class AIOrchestratorService {
  private readonly answer = new AIAnswerService();
  private readonly context = new AIContextService();
  private readonly modelRouter = new AIModelRouter();
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
      const tier = await this.modelRouter.getUserTier(userId);
      const plan = await this.planner.plan(trimmed, context);

      if (plan.mode === 'question') {
        const answer = await this.answer.answer(trimmed, context, this.modelRouter.roleForAnswer(tier));
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'question',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'answered',
          result: { answer },
        });

        return {
          success: true,
          intent: 'question',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: answer,
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      if (plan.mode === 'clarification') {
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'clarification',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'needs_clarification',
          result: { message: plan.message, missing: plan.missing ?? [] },
        });

        return {
          success: false,
          intent: 'clarification',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: plan.message,
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      const validated = await this.validator.validate(userId, plan);
      const parsed = this.preview.buildParsed(validated.summary, validated.actions);

      if (!validated.ok) {
        const message = validated.issues.map((issue) => issue.message).join('\n') || 'Нужно уточнение.';
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

      try {
        const context = await this.context.buildUserContext(userId);
        const tier = await this.modelRouter.getUserTier(userId);
        const answer = await this.answer.answer(trimmed, context, this.modelRouter.roleForAnswer(tier));
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'question_fallback',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'answered_after_planner_error',
          result: { answer },
          errorMessage: message,
        });

        return {
          success: true,
          intent: 'question_fallback',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: answer,
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      } catch {
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
          message: 'AI Core не смог обработать запрос: локальная модель не ответила или вернула некорректный JSON.',
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }
    }
  }

  async confirmCommand(userId: string, pendingActionId: string): Promise<AIResult> {
    const pending = await this.pending.getForConfirm(userId, pendingActionId);
    const parsed = pending.parsed as unknown as AIParsedCommand | null;

    if (!parsed || parsed.intent !== 'batch' || !Array.isArray(parsed.actions)) {
      throw new BadRequestError('Invalid pending action payload');
    }

    const result = await this.executor.execute(userId, parsed);
    await this.pending.markConfirmed(userId, pendingActionId);

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
      result,
    });

    return {
      success: true,
      intent: parsed.intent,
      executed: true,
      requiresConfirmation: false,
      riskLevel,
      message: parsed.actions.length === 1 ? 'Готово. Действие выполнено.' : `Готово. Выполнено действий: ${parsed.actions.length}.`,
      parsed: parsed as unknown as Record<string, unknown>,
      result,
      meta: { auditLogId: audit.id, undo: { available: false } },
    };
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

  private normalizeRisk(value: unknown): AIRiskLevel {
    return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
  }
}
