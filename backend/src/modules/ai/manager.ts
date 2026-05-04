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

      // Быстрый backend-layer: просьбы повторить не отправляем в LLM.
      // Работает и для «еще», и для «повтори 200»: категория/счёт берутся из последней операции.
      const repeatCommand = this.parseRepeatCommand(command);

      if (repeatCommand) {
        const repeatResult = await this.repeatLastTransaction(userId, repeatCommand.amount);
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

  private async repeatLastTransaction(userId: string, amountOverride?: number): Promise<AIResult> {
    const lastTransaction = await prisma.transaction.findFirst({
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
    });

    if (!lastTransaction) {
      return {
        success: false,
        intent: 'unknown',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: '🤔 Не нашёл прошлую операцию, которую можно повторить.',
        parsed: null,
      };
    }

    const type = lastTransaction.type === 'income' ? 'income' : 'expense';
    const categoryName = lastTransaction.category?.name ?? lastTransaction.description ?? 'операция';
    const categoryIcon = lastTransaction.category?.icon ?? (type === 'income' ? '💰' : '📝');

    const amount = typeof amountOverride === 'number' && amountOverride > 0
      ? amountOverride
      : lastTransaction.amount;

    const transaction = await transactionService.createTransaction(userId, {
      accountId: lastTransaction.accountId,
      categoryId: lastTransaction.categoryId ?? undefined,
      amount,
      type,
      description: lastTransaction.description ?? categoryName,
      isAIGenerated: true,
    });

    return {
      success: true,
      intent: type,
      executed: true,
      requiresConfirmation: false,
      riskLevel: 'low',
      message:
        type === 'expense'
          ? `✅ Повторил расход: ${categoryIcon} ${categoryName} — ${amount} ₽.`
          : `✅ Повторил доход: ${categoryIcon} ${categoryName} — ${amount} ₽.`,
      parsed: {
        type,
        amount,
        accountId: lastTransaction.accountId,
        accountName: lastTransaction.account.name,
        categoryId: lastTransaction.categoryId,
        categoryName,
        description: lastTransaction.description ?? categoryName,
        repeatedFromTransactionId: lastTransaction.id,
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

  private parseRepeatCommand(command: string): { amount?: number } | null {
    const normalized = this.normalizeRepeatText(command);

    if (!normalized) {
      return null;
    }

    const amount = this.extractAmountFromText(normalized);
    const textWithoutAmount = amount
      ? this.normalizeRepeatText(normalized.replace(amount.raw, ' '))
      : normalized;

    if (!this.isRepeatLikeText(textWithoutAmount)) {
      return null;
    }

    return amount ? { amount: amount.value } : {};
  }

  private extractAmountFromText(value: string): { value: number; raw: string } | null {
    const match = value.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s*(к|тыс|тысяч|млн|миллион|миллиона|миллионов|руб|рубль|рублей|р|₽))?(?=\s|$)/i);

    if (!match) {
      return null;
    }

    const numeric = Number(match[1].replace(',', '.'));

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    const suffix = (match[2] ?? '').toLowerCase();
    const multiplier =
      suffix === 'к' || suffix === 'тыс' || suffix === 'тысяч'
        ? 1000
        : suffix.startsWith('млн') || suffix.startsWith('миллион')
          ? 1000000
          : 1;

    return {
      value: Math.round(numeric * multiplier),
      raw: match[0],
    };
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
      /(^|\s)(повтор|повтори|повторить|повторяй)(\s|$)/.test(normalized) ||
      /(^|\s)(снова|опять)(\s|$)/.test(normalized) ||
      /(^|\s)(тоже|также)(\s|$)/.test(normalized) ||
      /(^|\s)то\s+же(\s|$)/.test(normalized) ||
      /(^|\s)так\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такую\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такой\s+же(\s|$)/.test(normalized) ||
      /(^|\s)(дублируй|продублируй)(\s|$)/.test(normalized)
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
