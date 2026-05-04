import { prisma } from "../../lib/prisma";
import { AIActionPolicy } from "./policy";
import { LLMCommandInterpreter } from "./llm-command-interpreter";
import { AIHandleOptions, AIResult } from "./types";
import { AIMemoryService } from "./ai-memory.service";
import { AITrainingService } from "./ai-training.service";
import { ProductEventsService } from "../analytics/product-events.service";
import { AIPreviewBuilder } from "./ai-preview.builder";
import { AIExecutorService } from "./ai-executor.service";
import { TransactionService } from "../transactions/service";

const transactionService = new TransactionService();

const REPEAT_WORDS = [
  "еще",
  "ещё",
  "еще раз",
  "ещё раз",
  "то же",
  "тоже",
  "повтор",
  "снова",
];

export class AIManager {
  private readonly parser = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();
  private readonly memory = new AIMemoryService();
  private readonly training = new AITrainingService();
  private readonly events = new ProductEventsService();
  private readonly preview = new AIPreviewBuilder();
  private readonly executor = new AIExecutorService();

  async handle(
    userId: string,
    command: string,
    options?: AIHandleOptions,
  ): Promise<AIResult> {
    const startedAt = Date.now();

    try {
      const execute = options?.execute ?? true;
      const confirmed = options?.confirmed ?? false;

      await this.events.track({
        userId,
        event: "ai_command_received",
        data: {
          commandLength: command.length,
        },
      });

      await this.memory.saveMessage({
        userId,
        role: "user",
        content: command,
      });

      const repeatResult = execute
        ? await this.tryRepeatLastTransaction(userId, command)
        : null;

      if (repeatResult) {
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      const history = await this.memory.getRecentMessages(userId, 6);
      const parsedCommand = await this.parser.parse(command, history);

      await this.applyContextFallback(parsedCommand, history);

      const policy = this.policy.evaluate(parsedCommand);

      if (!execute || (policy.requiresConfirmation && !confirmed)) {
        const previewResult = await this.preview.buildPreview(
          userId,
          parsedCommand,
          policy.requiresConfirmation,
          policy.riskLevel,
          policy.reason,
        );

        await this.logSuccess(userId, command, previewResult, startedAt);

        return previewResult;
      }

      const result = await this.executor.execute(
        userId,
        parsedCommand,
        policy.riskLevel,
      );

      await this.logSuccess(userId, command, result, startedAt);

      return result;
    } catch (error) {
      await this.training.save({
        userId,
        input: command,
        success: false,
        error: error instanceof Error ? error.message : "Unknown AI error",
        model: process.env.OLLAMA_MODEL,
        latencyMs: Date.now() - startedAt,
      });

      await this.events.track({
        userId,
        event: "ai_command_error",
        data: {
          error: error instanceof Error ? error.message : "Unknown AI error",
          latencyMs: Date.now() - startedAt,
        },
      });

      throw error;
    }
  }

  private async logSuccess(
    userId: string,
    command: string,
    result: AIResult,
    startedAt: number,
  ) {
    await this.memory.saveMessage({
      userId,
      role: "assistant",
      content: result.message,
      meta: {
        intent: result.intent,
        executed: result.executed,
        requiresConfirmation: result.requiresConfirmation,
        parsed: result.parsed,
      },
    });

    await this.training.save({
      userId,
      input: command,
      aiOutput: result.parsed,
      success: result.success,
      model: process.env.OLLAMA_MODEL,
      latencyMs: Date.now() - startedAt,
    });

    await this.events.track({
      userId,
      event: result.success ? "ai_command_success" : "ai_command_failed",
      data: {
        intent: result.intent,
        executed: result.executed,
        requiresConfirmation: result.requiresConfirmation,
        latencyMs: Date.now() - startedAt,
      },
    });
  }

  private async tryRepeatLastTransaction(
    userId: string,
    command: string,
  ): Promise<AIResult | null> {
    const repeat = this.parseRepeatCommand(command);

    if (!repeat.isRepeat) {
      return null;
    }

    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        userId,
        type: {
          in: ["expense", "income"],
        },
        categoryId: {
          not: null,
        },
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    if (!lastTransaction || !lastTransaction.category) {
      return {
        success: false,
        intent: "unknown",
        executed: false,
        requiresConfirmation: false,
        riskLevel: "low",
        message: "🤔 Не нашёл прошлую операцию, которую можно повторить.",
        parsed: null,
      };
    }

    const amount = repeat.amount ?? lastTransaction.amount;
    const transactionType = lastTransaction.type as "expense" | "income";

    const transaction = await transactionService.createTransaction(userId, {
      accountId: lastTransaction.accountId,
      categoryId: lastTransaction.categoryId,
      amount,
      type: transactionType,
      description: lastTransaction.description ?? lastTransaction.category.name,
      isAIGenerated: true,
    });

    const isExpense = transactionType === "expense";

    return {
      success: true,
      intent: transactionType,
      executed: true,
      requiresConfirmation: false,
      riskLevel: "low",
      message: isExpense
        ? `✅ Повторил расход: ${lastTransaction.category.icon ?? "📝"} ${lastTransaction.category.name} — ${amount} ₽.`
        : `✅ Повторил доход: ${lastTransaction.category.icon ?? "💰"} ${lastTransaction.category.name} — ${amount} ₽.`,
      parsed: {
        type: transactionType,
        amount,
        accountId: lastTransaction.accountId,
        accountName: lastTransaction.account.name,
        categoryId: lastTransaction.categoryId,
        categoryName: lastTransaction.category.name,
        description:
          lastTransaction.description ?? lastTransaction.category.name,
        repeatedFromTransactionId: lastTransaction.id,
      },
      data: transaction,
    };
  }

  private parseRepeatCommand(command: string): {
    isRepeat: boolean;
    amount?: number;
  } {
    const normalized = command.trim().toLowerCase().replace(/\s+/g, " ");

    for (const word of REPEAT_WORDS) {
      if (normalized === word) {
        return { isRepeat: true };
      }

      if (normalized.startsWith(`${word} `)) {
        const rest = normalized.slice(word.length).trim();
        const amountMatch = rest.match(/^(\d+[\d\s.,]*)/);

        if (!amountMatch) {
          return { isRepeat: true };
        }

        const amount = Number(
          amountMatch[1].replace(/\s/g, "").replace(",", "."),
        );

        return Number.isFinite(amount) && amount > 0
          ? { isRepeat: true, amount: Math.round(amount) }
          : { isRepeat: true };
      }
    }

    return { isRepeat: false };
  }

  private async applyContextFallback(parsedCommand: any, history: Array<any>) {
    if (
      parsedCommand.intent !== "expense" &&
      parsedCommand.intent !== "income"
    ) {
      return;
    }

    const weakCategories = [
      "еще",
      "ещё",
      "еще раз",
      "ещё раз",
      "то же",
      "тоже",
      "повтор",
      "снова",
    ];
    const currentCategory = String(parsedCommand.rawCategory ?? "")
      .trim()
      .toLowerCase();

    if (currentCategory && !weakCategories.includes(currentCategory)) {
      return;
    }

    const previousAssistantMessages = [...history]
      .reverse()
      .filter((message) => message.role === "assistant");

    for (const message of previousAssistantMessages) {
      try {
        const meta =
          typeof message.meta === "string"
            ? JSON.parse(message.meta)
            : message.meta;
        const parsed = meta?.parsed;

        if (
          !parsed ||
          parsed.type !== parsedCommand.intent ||
          !parsed.categoryName
        ) {
          continue;
        }

        parsedCommand.rawCategory = parsed.categoryName;

        if (
          (!parsedCommand.amount || parsedCommand.amount <= 0) &&
          typeof parsed.amount === "number" &&
          parsed.amount > 0
        ) {
          parsedCommand.amount = parsed.amount;
        }

        if (
          !parsedCommand.description ||
          weakCategories.includes(
            String(parsedCommand.description).trim().toLowerCase(),
          )
        ) {
          parsedCommand.description = parsed.categoryName;
        }

        return;
      } catch {
        // ignore broken memory meta
      }
    }
  }
}
