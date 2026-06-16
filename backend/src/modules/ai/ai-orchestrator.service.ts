import { BadRequestError } from "../../shared/core/errors";
import { AIContextService } from "./ai-context.service";
import { AIExecutorService } from "./ai-executor.service";
import { AIPlannerService } from "./ai-planner.service";
import { AIPreviewService } from "./ai-preview.service";
import { AIValidatorService } from "./ai-validator.service";
import { AIAnswerService } from "./ai-answer.service";
import { AIAuditService } from "./audit.service";
import { AIPendingActionService } from "./pending-action.service";
import { aiSessionService } from "./ai-session.service";
import {
  AIActionPlan,
  AIHandleOptions,
  AIParsedCommand,
  AIResult,
  AIRiskLevel,
} from "./types";
import { AICommandBuilderService } from "./ai-command-builder.service";
import { AIClarificationService } from "./ai-clarification.service";
import { AIExecutionLifecycleService } from "./ai-execution-lifecycle.service";
import { AIPlanLimitService } from "./ai-plan-limit.service";
import { AIModelRouter, AIUserTier } from "./ai-model-router";
import { AIDialogRoute, AIDialogRouterService } from "./ai-dialog-router.service";

export class AIOrchestratorService {
  private readonly context = new AIContextService();
  private readonly planner = new AIPlannerService();
  private readonly validator = new AIValidatorService();
  private readonly preview = new AIPreviewService();
  private readonly executor = new AIExecutorService();
  private readonly pending = new AIPendingActionService();
  private readonly audit = new AIAuditService();
  private readonly answer = new AIAnswerService();
  private readonly commandBuilder = new AICommandBuilderService();
  private readonly clarification = new AIClarificationService();
  private readonly lifecycle = new AIExecutionLifecycleService();
  private readonly planLimits = new AIPlanLimitService();
  private readonly modelRouter = new AIModelRouter();
  private readonly dialogRouter = new AIDialogRouterService();

  async handleCommand(
    userId: string,
    command: string,
    options: AIHandleOptions = {},
  ): Promise<AIResult> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError("command is required");

    const plannerCommand = this.commandBuilder.build(trimmed, options);

    try {
      const clarificationResult = await this.tryAnswerPendingClarification(
        userId,
        trimmed,
      );
      if (clarificationResult) return clarificationResult;

      const context = await this.context.buildUserContext(userId);
      const tier = await this.modelRouter.getUserTier(userId);
      const route = await this.dialogRouter.route(trimmed, context, tier);

      if (!route.shouldUseTools) {
        return this.answerDialog(userId, plannerCommand, trimmed, context, tier, route);
      }

      const plan = await this.planner.plan(plannerCommand, context);

      if (this.planLimits.isExceeded(plan)) {
        const audit = await this.audit.create({
          userId,
          command: plannerCommand,
          intent: "premium_action_limit",
          riskLevel: "low",
          requiresConfirmation: false,
          executed: false,
          status: "premium_action_limit",
          result: {
            actionCount: plan.actions.length,
            limit: this.planLimits.getLimit(),
          },
        });

        return {
          success: false,
          intent: "premium_action_limit",
          executed: false,
          requiresConfirmation: false,
          riskLevel: "low",
          message: `За один раз можно выполнить до ${this.planLimits.getLimit()} действий. Разбей запрос на несколько коротких команд.`,
          parsed: null,
          meta: { auditLogId: audit.id },
        };
      }

      if (!plan.actions.length) {
        return this.answerDialog(userId, plannerCommand, trimmed, context, tier, {
          ...route,
          shouldUseTools: false,
          intent: route.intent === "financial_action" ? "unclear" : route.intent,
          summary: plan.summary,
        });
      }

      const validated = await this.validator.validate(userId, plan);
      const parsed = this.preview.buildParsed(
        validated.summary,
        validated.actions,
      );

      if (!validated.ok) {
        const clarification = this.clarification.build(validated);
        if (clarification) {
          const parsedWithClarification = { ...parsed, clarification };
          const pending = await this.pending.create({
            userId,
            command: plannerCommand,
            parsed: parsedWithClarification,
            riskLevel: validated.riskLevel,
          });

          await aiSessionService.rememberClarification(userId, {
            command: plannerCommand,
            intent: parsed.intent,
            tool: parsed.actions[clarification.actionIndex]?.tool,
            payload: parsedWithClarification,
            clarification,
          });

          const audit = await this.audit.create({
            userId,
            command: plannerCommand,
            intent: parsed.intent,
            riskLevel: validated.riskLevel,
            requiresConfirmation: false,
            executed: false,
            status: "pending_clarification",
            parsed: parsedWithClarification,
            errorMessage: clarification.question,
          });

          return {
            success: true,
            intent: "clarification",
            executed: false,
            requiresConfirmation: false,
            riskLevel: validated.riskLevel,
            message: clarification.question,
            parsed: parsedWithClarification as unknown as Record<
              string,
              unknown
            >,
            meta: {
              auditLogId: audit.id,
              pendingActionId: pending.id,
              clarification,
            },
          };
        }

        const message =
          validated.issues.map((issue) => issue.message).join("\n") ||
          "Не удалось безопасно подготовить действие.";
        const audit = await this.audit.create({
          userId,
          command: plannerCommand,
          intent: "validation_failed",
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: false,
          status: "validation_failed",
          parsed,
          errorMessage: message,
        });

        return {
          success: false,
          intent: "validation_failed",
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
        await this.lifecycle.rememberSuccessfulExecution(
          userId,
          plannerCommand,
          parsed,
          result,
        );

        const audit = await this.audit.create({
          userId,
          command: plannerCommand,
          intent: parsed.intent,
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: true,
          status: "executed",
          parsed,
          result,
        });

        return {
          success: true,
          intent: parsed.intent,
          executed: true,
          requiresConfirmation: false,
          riskLevel: validated.riskLevel,
          message: this.buildExecutedResultMessage(parsed, result),
          parsed: parsed as unknown as Record<string, unknown>,
          result,
          meta: this.buildResultMeta(audit.id, parsed),
        };
      }

      const pending = await this.pending.create({
        userId,
        command: plannerCommand,
        parsed,
        riskLevel: validated.riskLevel,
      });

      const audit = await this.audit.create({
        userId,
        command: plannerCommand,
        intent: parsed.intent,
        riskLevel: validated.riskLevel,
        requiresConfirmation: true,
        executed: false,
        status: "pending_confirmation",
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
      const message = error instanceof Error ? error.message : "AI command failed";
      console.error("[AI] handleCommand failed", {
        message,
        command: plannerCommand,
      });
      const audit = await this.audit.create({
        userId,
        command: plannerCommand,
        intent: "error",
        riskLevel: "low",
        requiresConfirmation: false,
        executed: false,
        status: "error",
        errorMessage: message,
      });

      return {
        success: false,
        intent: "error",
        executed: false,
        requiresConfirmation: false,
        riskLevel: "low",
        message:
          "Не смогла подготовить действие. Напиши короче: что сделать, сумма и счёт, если он нужен.",
        parsed: null,
        meta: { auditLogId: audit.id },
      };
    }
  }

  async confirmCommand(
    userId: string,
    pendingActionId: string,
  ): Promise<AIResult> {
    const startedAt = Date.now();
    let pending: Awaited<
      ReturnType<AIPendingActionService["getForConfirm"]>
    > | null = null;
    let parsed: AIParsedCommand | null = null;

    try {
      pending = await this.pending.getForConfirm(userId, pendingActionId);
      parsed = pending.parsed as unknown as AIParsedCommand | null;

      if (
        !parsed ||
        parsed.intent !== "batch" ||
        !Array.isArray(parsed.actions)
      ) {
        throw new BadRequestError("Invalid pending action payload");
      }

      if (this.hasOpenClarification(parsed)) {
        const message = this.buildClarificationConfirmBlockedMessage(pending.command, parsed);
        const riskLevel = this.normalizeRisk(pending.riskLevel);
        const audit = await this.audit.create({
          userId,
          command: pending.command,
          intent: "clarification_confirm_blocked",
          riskLevel,
          requiresConfirmation: false,
          executed: false,
          status: "clarification_confirm_blocked",
          parsed,
          errorMessage: message,
          result: { pendingActionId, confirmElapsedMs: Date.now() - startedAt },
        });

        return {
          success: false,
          intent: "clarification",
          executed: false,
          requiresConfirmation: false,
          riskLevel,
          message,
          parsed: parsed as unknown as Record<string, unknown>,
          meta: {
            auditLogId: audit.id,
            pendingActionId,
            clarification: parsed.clarification ?? undefined,
          },
        };
      }

      const result = await this.executor.execute(userId, parsed, {
        pendingActionId,
      });

      const confirmedPending = await this.pending.markConfirmed(
        userId,
        pendingActionId,
      );
      if (!confirmedPending)
        throw new BadRequestError(
          "Pending action could not be marked as confirmed",
        );

      await this.lifecycle.rememberSuccessfulExecution(
        userId,
        pending.command,
        parsed,
        result,
      );

      const riskLevel = this.normalizeRisk(pending.riskLevel);
      const audit = await this.audit.create({
        userId,
        command: pending.command,
        intent: parsed.intent,
        riskLevel,
        requiresConfirmation: true,
        executed: true,
        status: "executed",
        parsed,
        result: {
          ...this.asResultObject(result),
          lifecycle: "pending_confirmed",
          confirmElapsedMs: Date.now() - startedAt,
        },
      });

      return {
        success: true,
        intent: parsed.intent,
        executed: true,
        requiresConfirmation: false,
        riskLevel,
        message: this.buildExecutedResultMessage(parsed, result),
        parsed: parsed as unknown as Record<string, unknown>,
        result,
        meta: this.buildResultMeta(audit.id, parsed),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Confirm failed";
      console.error("[AI] confirmCommand failed", { message, pendingActionId });

      const riskLevel = pending ? this.normalizeRisk(pending.riskLevel) : "low";
      const audit = await this.audit.create({
        userId,
        command: pending?.command ?? "",
        intent: parsed?.intent ?? pending?.intent ?? "confirm_error",
        riskLevel,
        requiresConfirmation: true,
        executed: false,
        status: "confirm_failed",
        parsed: parsed ?? pending?.parsed ?? { pendingActionId },
        errorMessage: message,
        result: { pendingActionId, confirmElapsedMs: Date.now() - startedAt },
      });

      return {
        success: false,
        intent: parsed?.intent ?? "confirm_error",
        executed: false,
        requiresConfirmation: false,
        riskLevel,
        message:
          "Не удалось выполнить действие. Проверь данные или уточни команду ещё раз.",
        parsed: parsed as unknown as Record<string, unknown> | null,
        meta: { auditLogId: audit.id },
      };
    }
  }


  private hasOpenClarification(parsed: AIParsedCommand | null): boolean {
    const clarification = parsed && (parsed as unknown as { clarification?: unknown }).clarification;
    return Boolean(clarification && typeof clarification === "object" && !Array.isArray(clarification));
  }

  private buildClarificationConfirmBlockedMessage(command: string, parsed: AIParsedCommand): string {
    const question = (parsed as unknown as { clarification?: { question?: unknown } }).clarification?.question;
    const fallback = typeof question === "string" && question.trim() ? question.trim() : null;
    if (this.looksEnglish(command)) {
      return fallback && !/[а-яё]/i.test(fallback)
        ? fallback
        : "Please answer the question first. I cannot confirm the action until the missing details are filled in.";
    }
    return fallback ?? "Сначала ответь на уточнение. Я не буду выполнять действие, пока не хватает данных.";
  }

  private looksEnglish(value: string): boolean {
    const latin = (value.match(/[a-z]/gi) ?? []).length;
    const cyrillic = (value.match(/[а-яё]/gi) ?? []).length;
    return latin > cyrillic;
  }

  async updatePendingAction(
    userId: string,
    pendingActionId: string,
    parsed: Record<string, unknown>,
    command?: string,
  ) {
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
      message: "Действие отменено.",
      parsed: pending.parsed,
    } satisfies AIResult;
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return this.pending.list(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return this.audit.list(userId, limit);
  }

  private async answerDialog(
    userId: string,
    plannerCommand: string,
    userMessage: string,
    context: unknown,
    tier: AIUserTier,
    route: AIDialogRoute,
  ): Promise<AIResult> {
    const role = this.modelRouter.roleForAnswer(tier);
    const companionAnswer = await this.answer.answer(userMessage, context, role, route.summary, {
      tier: String(tier || "FREE"),
      intent: route.intent,
      style: route.answerStyle,
    });

    const audit = await this.audit.create({
      userId,
      command: plannerCommand,
      intent: route.intent,
      riskLevel: "low",
      requiresConfirmation: false,
      executed: false,
      status: "dialog_reply",
      result: {
        route,
        tier,
        modelRole: role,
      },
    });

    return {
      success: true,
      intent: route.intent,
      executed: false,
      requiresConfirmation: false,
      riskLevel: "low",
      message: companionAnswer,
      parsed: null,
      meta: { auditLogId: audit.id },
    };
  }

  private async tryAnswerPendingClarification(
    userId: string,
    answer: string,
  ): Promise<AIResult | null> {
    const pending = await this.pending.getLatestClarification(userId);
    if (!pending) return null;

    const parsed = pending.parsed as unknown as AIParsedCommand | null;
    const clarification = parsed?.clarification;

    if (
      !parsed ||
      parsed.intent !== "batch" ||
      !Array.isArray(parsed.actions) ||
      !clarification
    )
      return null;
    const action = parsed.actions[clarification.actionIndex];
    if (!action) return null;

    const candidate = answer.trim();
    if (!candidate) return null;

    if (clarification.type === "account_setup") {
      return this.answerFirstAccountSetupClarification(userId, pending, parsed, candidate);
    }

    if (this.clarification.looksLikeNewCommand(candidate)) {
      await this.pending
        .markFailed(userId, pending.id, "superseded_by_new_command")
        .catch(() => null);
      await aiSessionService.clear(userId).catch(() => null);
      return null;
    }

    const nextActions = parsed.actions.map((item, index) => {
      if (index !== clarification.actionIndex) return item;
      const field = clarification.field || "account";
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
      mode: "actions",
      summary: parsed.summary,
      actions: nextActions,
    };

    const validated = await this.validator.validate(userId, nextPlan);
    const nextParsed = this.preview.buildParsed(
      validated.summary,
      validated.actions,
    );

    if (!validated.ok) {
      const stillNeedsEntity = this.clarification.build(validated);

      if (stillNeedsEntity) {
        const parsedWithClarification = { ...nextParsed, clarification: stillNeedsEntity };
        await this.pending.update(
          userId,
          pending.id,
          parsedWithClarification as unknown as Record<string, unknown>,
          `${pending.command} / ${candidate}`,
        );

        await aiSessionService.rememberClarification(userId, {
          command: `${pending.command} / ${candidate}`,
          intent: nextParsed.intent,
          tool: nextParsed.actions[stillNeedsEntity.actionIndex]?.tool,
          payload: parsedWithClarification,
          clarification: stillNeedsEntity,
        });

        const audit = await this.audit.create({
          userId,
          command: `${pending.command} / ${candidate}`,
          intent: nextParsed.intent,
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: false,
          status: "pending_clarification_after_clarification",
          parsed: parsedWithClarification,
          errorMessage: stillNeedsEntity.question,
        });

        return {
          success: true,
          intent: "clarification",
          executed: false,
          requiresConfirmation: false,
          riskLevel: validated.riskLevel,
          message: stillNeedsEntity.question,
          parsed: parsedWithClarification as unknown as Record<string, unknown>,
          meta: { auditLogId: audit.id, pendingActionId: pending.id, clarification: stillNeedsEntity },
        };
      }

      const message = validated.issues.map((issue) => issue.message).join("\n") ||
        "Не удалось применить уточнение.";

      const audit = await this.audit.create({
        userId,
        command: `${pending.command} / ${candidate}`,
        intent: "clarification_failed",
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: false,
        status: "clarification_failed",
        parsed: nextParsed,
        errorMessage: message,
      });

      return {
        success: false,
        intent: "clarification_failed",
        executed: false,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message,
        parsed: nextParsed as unknown as Record<string, unknown>,
        meta: { auditLogId: audit.id, pendingActionId: pending.id },
      };
    }

    await this.pending.update(
      userId,
      pending.id,
      nextParsed as unknown as Record<string, unknown>,
      `${pending.command} / ${candidate}`,
    );

    if (!validated.requiresConfirmation) {
      const result = await this.executor.execute(userId, nextParsed, {
        pendingActionId: pending.id,
      });
      await this.pending.markConfirmed(userId, pending.id).catch(() => null);
      await this.lifecycle.rememberSuccessfulExecution(
        userId,
        `${pending.command} / ${candidate}`,
        nextParsed,
        result,
      );

      const audit = await this.audit.create({
        userId,
        command: `${pending.command} / ${candidate}`,
        intent: nextParsed.intent,
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: true,
        status: "executed_after_clarification",
        parsed: nextParsed,
        result,
      });

      return {
        success: true,
        intent: nextParsed.intent,
        executed: true,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message: this.buildExecutedResultMessage(nextParsed, result),
        parsed: nextParsed as unknown as Record<string, unknown>,
        result,
        meta: this.buildResultMeta(audit.id, nextParsed, pending.id),
      };
    }

    const audit = await this.audit.create({
      userId,
      command: `${pending.command} / ${candidate}`,
      intent: nextParsed.intent,
      riskLevel: validated.riskLevel,
      requiresConfirmation: true,
      executed: false,
      status: "pending_confirmation_after_clarification",
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

  private async answerFirstAccountSetupClarification(
    userId: string,
    pending: Awaited<ReturnType<AIPendingActionService["getLatestClarification"]>>,
    parsed: AIParsedCommand,
    candidate: string,
  ): Promise<AIResult> {
    if (!pending) {
      throw new BadRequestError("Pending action is missing");
    }

    const plannerCommand = [
      'Пользователь начал финансовое действие, но у него ещё нет счетов.',
      `Исходная просьба: ${pending.command}`,
      `Ответ пользователя для первого счёта: ${candidate}`,
      'Составь один план: сначала создать счёт из ответа пользователя, затем продолжить исходную просьбу.',
      'Если для исходной просьбы всё ещё не хватает суммы или детали, оставь это поле пустым, чтобы валидатор задал короткий вопрос.',
    ].join('\n');

    const context = await this.context.buildUserContext(userId);
    const plan = await this.planner.plan(plannerCommand, context);
    const validated = await this.validator.validate(userId, plan);
    const nextParsed = this.preview.buildParsed(validated.summary, validated.actions);
    const nextCommand = `${pending.command} / ${candidate}`;

    if (!validated.ok) {
      const nextClarification = this.clarification.build(validated);

      if (nextClarification) {
        const parsedWithClarification = { ...nextParsed, clarification: nextClarification };
        await this.pending.update(
          userId,
          pending.id,
          parsedWithClarification as unknown as Record<string, unknown>,
          nextCommand,
        );

        await aiSessionService.rememberClarification(userId, {
          command: nextCommand,
          intent: nextParsed.intent,
          tool: nextParsed.actions[nextClarification.actionIndex]?.tool,
          payload: parsedWithClarification,
          clarification: nextClarification,
        });

        const audit = await this.audit.create({
          userId,
          command: nextCommand,
          intent: nextParsed.intent,
          riskLevel: validated.riskLevel,
          requiresConfirmation: false,
          executed: false,
          status: "pending_first_account_continuation",
          parsed: parsedWithClarification,
          errorMessage: nextClarification.question,
        });

        return {
          success: true,
          intent: "clarification",
          executed: false,
          requiresConfirmation: false,
          riskLevel: validated.riskLevel,
          message: nextClarification.question,
          parsed: parsedWithClarification as unknown as Record<string, unknown>,
          meta: { auditLogId: audit.id, pendingActionId: pending.id, clarification: nextClarification },
        };
      }

      const message = validated.issues.map((issue) => issue.message).join("\n") ||
        this.clarification.buildRetryMessage(parsed.clarification!, candidate);
      const audit = await this.audit.create({
        userId,
        command: nextCommand,
        intent: "first_account_setup_failed",
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: false,
        status: "first_account_setup_failed",
        parsed: nextParsed,
        errorMessage: message,
      });

      return {
        success: false,
        intent: "first_account_setup_failed",
        executed: false,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message,
        parsed: nextParsed as unknown as Record<string, unknown>,
        meta: { auditLogId: audit.id, pendingActionId: pending.id },
      };
    }

    await this.pending.update(
      userId,
      pending.id,
      nextParsed as unknown as Record<string, unknown>,
      nextCommand,
    );

    if (!validated.requiresConfirmation) {
      const result = await this.executor.execute(userId, nextParsed, {
        pendingActionId: pending.id,
      });
      await this.pending.markConfirmed(userId, pending.id).catch(() => null);
      await this.lifecycle.rememberSuccessfulExecution(userId, nextCommand, nextParsed, result);

      const audit = await this.audit.create({
        userId,
        command: nextCommand,
        intent: nextParsed.intent,
        riskLevel: validated.riskLevel,
        requiresConfirmation: false,
        executed: true,
        status: "executed_after_first_account_setup",
        parsed: nextParsed,
        result,
      });

      return {
        success: true,
        intent: nextParsed.intent,
        executed: true,
        requiresConfirmation: false,
        riskLevel: validated.riskLevel,
        message: this.buildExecutedResultMessage(nextParsed, result),
        parsed: nextParsed as unknown as Record<string, unknown>,
        result,
        meta: this.buildResultMeta(audit.id, nextParsed, pending.id),
      };
    }

    const audit = await this.audit.create({
      userId,
      command: nextCommand,
      intent: nextParsed.intent,
      riskLevel: validated.riskLevel,
      requiresConfirmation: true,
      executed: false,
      status: "pending_confirmation_after_first_account_setup",
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

  private buildResultMeta(auditLogId: string, parsed: AIParsedCommand, pendingActionId?: string): AIResult['meta'] {
    return {
      auditLogId,
      ...(pendingActionId ? { pendingActionId } : {}),
      ...(this.hasUndoableAction(parsed) ? { undo: { available: true } } : {}),
    };
  }

  private hasUndoableAction(parsed: AIParsedCommand) {
    return parsed.actions.some((action) => action.tool === 'create_transaction' || action.tool === 'transfer_money');
  }

  private buildExecutedResultMessage(parsed: AIParsedCommand, result: unknown) {
    const analyticsMessage = this.buildAnalyticsResultMessage(parsed, result);
    if (analyticsMessage) return analyticsMessage;
    return this.preview.buildExecutedMessage(parsed);
  }

  private buildAnalyticsResultMessage(parsed: AIParsedCommand, result: unknown) {
    const hasAnalyticsAction = parsed.actions.length === 1 && parsed.actions[0]?.tool === 'query_analytics';
    if (!hasAnalyticsAction) return '';

    const root = this.asResultObject(result);
    const results = Array.isArray(root.results) ? root.results : [];
    const first = this.asResultObject(results[0]);
    const analytics = this.asResultObject(first.analytics);
    const totals = this.asResultObject(analytics.totals);
    const transactionsCount = Number(totals.transactionsCount ?? 0);
    const expenses = Number(totals.expenses ?? 0);
    const income = Number(totals.income ?? 0);
    const period = this.analyticsPeriodLabel(String(analytics.period ?? parsed.actions[0]?.input?.period ?? 'month'));

    if (!transactionsCount) {
      return `${period} операций пока нет. Когда появятся расходы или доходы, я покажу итог прямо здесь.`;
    }

    const parts = [`${period} расходы: ${this.formatRub(expenses)}.`];
    if (income > 0) parts.push(`Доходы: ${this.formatRub(income)}.`);

    const topCategories = Array.isArray(analytics.topCategories) ? analytics.topCategories : [];
    const top = this.asResultObject(topCategories[0]);
    const topName = typeof top.name === 'string' ? top.name : '';
    const topAmount = Number(top.amount ?? 0);
    if (topName && topAmount > 0) parts.push(`Больше всего — ${topName}: ${this.formatRub(topAmount)}.`);
    if (transactionsCount > 0) parts.push('Если нужны графики, можно открыть аналитику.');

    return parts.join(' ');
  }

  private analyticsPeriodLabel(period: string) {
    if (period === 'today') return 'Сегодня';
    if (period === 'week') return 'За неделю';
    if (period === 'year') return 'За год';
    if (period === 'all') return 'За всё время';
    return 'За месяц';
  }

  private formatRub(value: number) {
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)))} ₽`;
  }

  private asResultObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { value };
  }

  private normalizeRisk(value: unknown): AIRiskLevel {
    return value === "high" || value === "medium" || value === "low"
      ? value
      : "low";
  }
}
