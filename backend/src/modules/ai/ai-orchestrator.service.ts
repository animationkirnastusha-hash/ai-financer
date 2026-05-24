import { BadRequestError } from '../../shared/core/errors';
import { AIContextService } from './ai-context.service';
import { AIExecutorService } from './ai-executor.service';
import { AIPlannerService } from './ai-planner.service';
import { AIPreviewService } from './ai-preview.service';
import { AIValidatorService } from './ai-validator.service';
import { AIAnswerService } from './ai-answer.service';
import { AIAuditService } from './audit.service';
import { AIPendingActionService } from './pending-action.service';
import { aiSessionService } from './ai-session.service';
import { AIMemoryService } from './ai-memory.service';
import { AIActionPlan, AIClarificationRequest, AIHandleOptions, AIParsedCommand, AIResult, AIRiskLevel, AIValidatedPlan } from './types';

export class AIOrchestratorService {
  private readonly context = new AIContextService();
  private readonly planner = new AIPlannerService();
  private readonly validator = new AIValidatorService();
  private readonly preview = new AIPreviewService();
  private readonly executor = new AIExecutorService();
  private readonly pending = new AIPendingActionService();
  private readonly audit = new AIAuditService();
  private readonly answer = new AIAnswerService();
  private readonly memory = new AIMemoryService();

  async handleCommand(userId: string, command: string, _options: AIHandleOptions = {}): Promise<AIResult> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('command is required');

    try {
      const clarificationResult = await this.tryAnswerPendingClarification(userId, trimmed);
      if (clarificationResult) return clarificationResult;

      const context = await this.context.buildUserContext(userId);
      const plan = await this.planner.plan(trimmed, context);

      if (plan.actions.length > 3) {
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'premium_action_limit',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'premium_action_limit',
          result: { actionCount: plan.actions.length },
        });

        return {
          success: false,
          intent: 'premium_action_limit',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: 'В одном запросе можно выполнить до трёх действий. Больше трёх задач за раз будет доступно в Premium.',
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      if (!plan.actions.length) {
        const companionAnswer = await this.answer.answer(trimmed, context, 'fast', plan.summary);
        const audit = await this.audit.create({
          userId,
          command: trimmed,
          intent: 'companion_reply',
          riskLevel: 'low',
          requiresConfirmation: false,
          executed: false,
          status: 'companion_reply',
          result: { domain: 'non_finance_or_unclear', memoryEligible: false, plan },
        });

        return {
          success: true,
          intent: 'companion_reply',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: companionAnswer,
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      const validated = await this.validator.validate(userId, plan);
      const parsed = this.preview.buildParsed(validated.summary, validated.actions);

      if (!validated.ok) {
        const clarification = this.buildClarification(validated);
        if (clarification) {
          const parsedWithClarification = { ...parsed, clarification };
          const pending = await this.pending.create({
            userId,
            command: trimmed,
            parsed: parsedWithClarification,
            riskLevel: validated.riskLevel,
          });

          await aiSessionService.rememberClarification(userId, { command: trimmed, intent: parsed.intent, tool: parsed.actions[clarification.actionIndex]?.tool, payload: parsedWithClarification, clarification });

          const audit = await this.audit.create({
            userId,
            command: trimmed,
            intent: parsed.intent,
            riskLevel: validated.riskLevel,
            requiresConfirmation: false,
            executed: false,
            status: 'pending_clarification',
            parsed: parsedWithClarification,
            errorMessage: clarification.question,
          });

          return {
            success: true,
            intent: 'clarification',
            executed: false,
            requiresConfirmation: false,
            riskLevel: validated.riskLevel,
            message: clarification.question,
            parsed: parsedWithClarification as unknown as Record<string, unknown>,
            meta: { auditLogId: audit.id, pendingActionId: pending.id, clarification },
          };
        }

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
        await aiSessionService.clear(userId);
        await aiSessionService.rememberResult(userId, { command: trimmed, intent: parsed.intent, tool: parsed.actions[0]?.tool, result });
        await this.memory.rememberFinancialResult(userId, { command: trimmed, intent: parsed.intent, tools: parsed.actions.map((action) => action.tool), result });

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
          meta: { auditLogId: audit.id, undo: { available: true } },
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

      await aiSessionService.clear(userId);
      await aiSessionService.rememberResult(userId, { command: pending.command, intent: parsed.intent, tool: parsed.actions[0]?.tool, result });
      await this.memory.rememberFinancialResult(userId, { command: pending.command, intent: parsed.intent, tools: parsed.actions.map((action) => action.tool), result });

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
        meta: { auditLogId: audit.id, pendingActionId, undo: { available: true } },
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


  private async tryAnswerPendingClarification(userId: string, answer: string): Promise<AIResult | null> {
    const pending = await this.pending.getLatestClarification(userId);
    if (!pending) return null;

    const parsed = pending.parsed as unknown as AIParsedCommand | null;
    const clarification = parsed?.clarification;

    if (!parsed || parsed.intent !== 'batch' || !Array.isArray(parsed.actions) || !clarification) return null;
    const action = parsed.actions[clarification.actionIndex];
    if (!action) return null;

    const candidate = answer.trim();
    if (!candidate) return null;

    const nextActions = parsed.actions.map((item, index) => {
      if (index !== clarification.actionIndex) return item;
      const field = clarification.field || 'account';
      return {
        ...item,
        input: {
          ...item.input,
          [field]: candidate,
          __userText: `${pending.command} ${candidate}`,
        },
      };
    });

    const nextPlan: AIActionPlan = {
      mode: 'actions',
      summary: parsed.summary,
      actions: nextActions,
    };

    const validated = await this.validator.validate(userId, nextPlan);
    const nextParsed = this.preview.buildParsed(validated.summary, validated.actions);

    if (!validated.ok) {
      const stillNeedsEntity = this.buildClarification(validated);
      const message = stillNeedsEntity
        ? `${stillNeedsEntity.question} Я не нашёл: ${candidate}.`
        : validated.issues.map((issue) => issue.message).join('\n') || 'Не удалось применить уточнение.';

      const audit = await this.audit.create({
        userId,
        command: `${pending.command} / ${candidate}`,
        intent: 'clarification_failed',
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: false,
        status: 'clarification_failed',
        parsed: nextParsed,
        errorMessage: message,
      });

      return {
        success: false,
        intent: 'clarification_failed',
        executed: false,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message,
        parsed: nextParsed as unknown as Record<string, unknown>,
        meta: { auditLogId: audit.id, pendingActionId: pending.id },
      };
    }

    await this.pending.update(userId, pending.id, nextParsed as unknown as Record<string, unknown>, `${pending.command} / ${candidate}`);

    if (!validated.requiresConfirmation) {
      const result = await this.executor.execute(userId, nextParsed, { pendingActionId: pending.id });
      await aiSessionService.clear(userId);
      await aiSessionService.rememberResult(userId, { command: `${pending.command} / ${candidate}`, intent: nextParsed.intent, tool: nextParsed.actions[0]?.tool, result });
      await this.memory.rememberFinancialResult(userId, { command: `${pending.command} / ${candidate}`, intent: nextParsed.intent, tools: nextParsed.actions.map((action) => action.tool), result });

      const audit = await this.audit.create({
        userId,
        command: `${pending.command} / ${candidate}`,
        intent: nextParsed.intent,
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: true,
        status: 'executed_after_clarification',
        parsed: nextParsed,
        result,
      });

      return {
        success: true,
        intent: nextParsed.intent,
        executed: true,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message: this.preview.buildExecutedMessage(nextParsed),
        parsed: nextParsed as unknown as Record<string, unknown>,
        result,
        meta: { auditLogId: audit.id, pendingActionId: pending.id, undo: { available: true } },
      };
    }

    const audit = await this.audit.create({
      userId,
      command: `${pending.command} / ${candidate}`,
      intent: nextParsed.intent,
      riskLevel: validated.riskLevel,
      requiresConfirmation: true,
      executed: false,
      status: 'pending_confirmation_after_clarification',
      parsed: nextParsed,
    });

    return {
      success: true,
      intent: nextParsed.intent,
      executed: false,
      requiresConfirmation: true,
      riskLevel: validated.riskLevel,
      message: this.preview.buildMessage(nextParsed),
      parsed: nextParsed as unknown as Record<string, unknown>,
      meta: { auditLogId: audit.id, pendingActionId: pending.id },
    };
  }

  private buildClarification(validated: AIValidatedPlan): AIClarificationRequest | null {
    const issue = validated.issues.find((item) => [
      'needs_account_clarification',
      'account_not_found',
      'from_account_not_found',
      'to_account_not_found',
      'goal_not_found',
      'category_not_found',
      'section_not_found',
      'transaction_not_found',
    ].includes(item.code) && typeof item.actionIndex === 'number');

    if (!issue || typeof issue.actionIndex !== 'number') return null;

    if (issue.code === 'transaction_not_found') {
      return { type: 'transaction', field: 'transaction', actionIndex: issue.actionIndex, question: 'Какую операцию нужно изменить?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'goal_not_found') {
      return { type: 'goal', field: 'goal', actionIndex: issue.actionIndex, question: 'Какую цель нужно изменить?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'category_not_found') {
      return { type: 'category', field: 'category', actionIndex: issue.actionIndex, question: 'Какую категорию использовать?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'section_not_found') {
      return { type: 'section', field: 'section', actionIndex: issue.actionIndex, question: 'Какой раздел использовать?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'from_account_not_found') {
      return { type: 'account', field: 'fromAccount', actionIndex: issue.actionIndex, question: 'С какого счёта перевести?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'to_account_not_found') {
      return { type: 'account', field: 'toAccount', actionIndex: issue.actionIndex, question: 'На какой счёт перевести?', createdAt: new Date().toISOString() };
    }

    return { type: 'account', field: 'account', actionIndex: issue.actionIndex, question: 'Какой счёт использовать?', createdAt: new Date().toISOString() };
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
