import { prisma } from '../../lib/prisma';
import { TransactionService } from '../transactions/service';
import { AIActionPolicy } from './policy';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';
import { AIMemoryService } from './ai-memory.service';
import { AITrainingService } from './ai-training.service';
import { ProductEventsService } from '../analytics/product-events.service';
import { AIPreviewBuilder } from './ai-preview.builder';
import { AIExecutorService } from './ai-executor.service';

const transactionService = new TransactionService();

export class AIManager {
  private readonly parser = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();
  private readonly memory = new AIMemoryService();
  private readonly training = new AITrainingService();
  private readonly events = new ProductEventsService();
  private readonly preview = new AIPreviewBuilder();
  private readonly executor = new AIExecutorService();

  async handle(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    const startedAt = Date.now();

    try {
      const execute = options?.execute ?? true;
      const confirmed = options?.confirmed ?? false;

      await this.events.track({
        userId,
        event: 'ai_command_received',
        data: {
          commandLength: command.length,
        },
      });

      await this.memory.saveMessage({
        userId,
        role: 'user',
        content: command,
      });

      // Быстрый backend-layer: команды повтора обрабатываем до LLM.
      // Поддерживает: «ещё», «повтори», «повтор», «повтори 200», «ещё 200».
      const repeatCommand = this.parseRepeatCommand(command);

      if (repeatCommand.isRepeat) {
        const repeatResult = await this.repeatLastTransaction(
          userId,
          repeatCommand.amount,
          repeatCommand.categoryQuery,
        );
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      const history = await this.memory.getRecentMessages(userId, 6);
      const parsedCommand = await this.parser.parse(command, history);

      if (parsedCommand.intent === 'repeat_last') {
        const repeatResult = await this.repeatLastTransaction(userId);
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

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

      const result = await this.executor.execute(userId, parsedCommand, policy.riskLevel);

      await this.logSuccess(userId, command, result, startedAt);

      return result;
    } catch (error) {
      await this.training.save({
        userId,
        input: command,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AI error',
        model: process.env.OLLAMA_MODEL,
        latencyMs: Date.now() - startedAt,
      });

      await this.events.track({
        userId,
        event: 'ai_command_error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown AI error',
          latencyMs: Date.now() - startedAt,
        },
      });

      throw error;
    }
  }

  private async logSuccess(userId: string, command: string, result: AIResult, startedAt: number) {
    await this.memory.saveMessage({
      userId,
      role: 'assistant',
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
      event: result.success ? 'ai_command_success' : 'ai_command_failed',
      data: {
        intent: result.intent,
        executed: result.executed,
        requiresConfirmation: result.requiresConfirmation,
        latencyMs: Date.now() - startedAt,
      },
    });
  }

  private async applyContextFallback(parsedCommand: AIParsedCommand, history: Array<any>) {
    if (parsedCommand.intent !== 'expense' && parsedCommand.intent !== 'income') {
      return;
    }

    const currentCategory = String(parsedCommand.rawCategory ?? '').trim().toLowerCase();

    const shouldUsePreviousCategory =
      !currentCategory ||
      this.isRepeatLikeText(currentCategory) ||
      currentCategory === 'расход' ||
      currentCategory === 'доход';

    if (!shouldUsePreviousCategory) {
      return;
    }

    const previousAssistantMessages = [...history]
      .reverse()
      .filter((message) => message.role === 'assistant');

    for (const message of previousAssistantMessages) {
      const parsed = this.readParsedFromMemory(message);

      if (
        parsed &&
        parsed.type === parsedCommand.intent &&
        typeof parsed.categoryName === 'string' &&
        parsed.categoryName.trim()
      ) {
        parsedCommand.rawCategory = parsed.categoryName;

        if (
          !parsedCommand.description ||
          this.isRepeatLikeText(String(parsedCommand.description))
        ) {
          parsedCommand.description = parsed.categoryName;
        }

        return;
      }
    }
  }

  private async repeatLastTransaction(
    userId: string,
    amountOverride?: number,
    categoryQuery?: string,
  ): Promise<AIResult> {
    const amount = amountOverride !== undefined ? this.normalizeAmountOverride(amountOverride) : undefined;
    const normalizedCategoryQuery = categoryQuery ? this.normalizeSearchText(categoryQuery) : '';

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: {
          in: ['expense', 'income'],
        },
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
      take: normalizedCategoryQuery ? 80 : 1,
    });

    const lastTransaction = normalizedCategoryQuery
      ? recentTransactions.find((transaction) => {
          const categoryName = this.normalizeSearchText(transaction.category?.name ?? '');
          const description = this.normalizeSearchText(transaction.description ?? '');

          return (
            categoryName.includes(normalizedCategoryQuery) ||
            normalizedCategoryQuery.includes(categoryName) ||
            description.includes(normalizedCategoryQuery) ||
            normalizedCategoryQuery.includes(description)
          );
        })
      : recentTransactions[0];

    if (!lastTransaction) {
      return {
        success: false,
        intent: 'unknown',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: normalizedCategoryQuery
          ? `🤔 Не нашёл прошлую операцию по запросу «${categoryQuery}». Попробуй: «кофе 300» или «повтори».`
          : '🤔 Не нашёл прошлую операцию, которую можно повторить. Попробуй сначала записать расход: «кофе 300».',
        parsed: null,
      };
    }

    const type = lastTransaction.type === 'income' ? 'income' : 'expense';
    const categoryName = lastTransaction.category?.name ?? lastTransaction.description ?? 'операция';
    const categoryIcon = lastTransaction.category?.icon ?? (type === 'income' ? '💰' : '📝');
    const repeatAmount = amount ?? lastTransaction.amount;

    const transaction = await transactionService.createTransaction(userId, {
      accountId: lastTransaction.accountId,
      categoryId: lastTransaction.categoryId ?? undefined,
      amount: repeatAmount,
      type,
      description: categoryName,
      isAIGenerated: true,
    });

    await this.events.track({
      userId,
      event: 'repeat_used',
      data: {
        amount: repeatAmount,
        amountOverridden: amount !== undefined,
        categoryQuery: categoryQuery ?? null,
        repeatedFromTransactionId: lastTransaction.id,
      },
    });

    return {
      success: true,
      intent: type,
      executed: true,
      requiresConfirmation: false,
      riskLevel: 'low',
      message:
        type === 'expense'
          ? `✅ Повторил расход: ${categoryIcon} ${categoryName} — ${repeatAmount} ₽.`
          : `✅ Повторил доход: ${categoryIcon} ${categoryName} — ${repeatAmount} ₽.`,
      parsed: {
        type,
        amount: repeatAmount,
        accountId: lastTransaction.accountId,
        accountName: lastTransaction.account.name,
        categoryId: lastTransaction.categoryId,
        categoryName,
        description: categoryName,
        repeatedFromTransactionId: lastTransaction.id,
        categoryQuery: categoryQuery ?? null,
      },
      data: transaction,
    };
  }

  private readParsedFromMemory(message: any): Record<string, any> | null {
    try {
      const meta = typeof message.meta === 'string' ? JSON.parse(message.meta) : message.meta;
      const parsed = meta?.parsed;

      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private parseRepeatCommand(command: string): {
    isRepeat: boolean;
    amount?: number;
    categoryQuery?: string;
  } {
    const normalized = this.normalizeRepeatText(command);

    if (!normalized || !this.isRepeatLikeText(normalized)) {
      return { isRepeat: false };
    }

    const amountMatch = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/);
    const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined;

    const categoryQuery = this.extractRepeatCategoryQuery(normalized, amountMatch?.[1]);

    return {
      isRepeat: true,
      ...(amount !== undefined && Number.isFinite(amount) && amount > 0 ? { amount } : {}),
      ...(categoryQuery ? { categoryQuery } : {}),
    };
  }

  private extractRepeatCategoryQuery(normalizedCommand: string, rawAmount?: string) {
    let query = normalizedCommand
      .replace(/\b(еще|ещё|повтор\w*|повтори|повторить|повторяй|снова|опять|тоже|также|дублируй|продублируй|дубль|продублировать)\b/g, ' ')
      .replace(/\bто\s+же\b/g, ' ')
      .replace(/\bтак\s+же\b/g, ' ')
      .replace(/\bтакую\s+же\b/g, ' ')
      .replace(/\bтакой\s+же\b/g, ' ')
      .replace(/\bоперац\w*\b/g, ' ')
      .replace(/\bтранзакц\w*\b/g, ' ')
      .replace(/\bрасход\w*\b/g, ' ')
      .replace(/\bдоход\w*\b/g, ' ');

    if (rawAmount) {
      query = query.replace(new RegExp(`(^|\\s)${rawAmount.replace('.', '\\.').replace(',', '[,.]')}(\\s|$)`), ' ');
    }

    query = query.replace(/\s+/g, ' ').trim();

    return query || undefined;
  }

  private normalizeAmountOverride(value: number) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('❌ Неверная сумма. Напиши целое число больше нуля, например: «повтори 200».');
    }

    if (amount > 1_000_000) {
      throw new Error('❌ Сумма слишком большая. Для крупных операций нужно отдельное подтверждение.');
    }

    return amount;
  }

  private normalizeSearchText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,!?;:()\[\]{}"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isRepeatLikeText(value: string) {
    const normalized = this.normalizeRepeatText(value);

    if (!normalized) {
      return false;
    }

    const words = normalized.split(' ').filter(Boolean);

    // Повтор обычно короткий. Длинные фразы отправляем в LLM, чтобы не перехватывать лишнее.
    if (words.length > 6) {
      return false;
    }

    return (
      /(^|\s)(еще|ещё)(\s|$)/.test(normalized) ||
      /(^|\s)(повтор\w*|повтори|повторить|повторяй)(\s|$)/.test(normalized) ||
      /(^|\s)(снова|опять)(\s|$)/.test(normalized) ||
      /(^|\s)(тоже|также)(\s|$)/.test(normalized) ||
      /(^|\s)то\s+же(\s|$)/.test(normalized) ||
      /(^|\s)так\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такую\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такой\s+же(\s|$)/.test(normalized) ||
      /(^|\s)(дублируй|продублируй|дубль|продублировать)(\s|$)/.test(normalized)
    );
  }

  private normalizeRepeatText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,!?;:()\[\]{}"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
