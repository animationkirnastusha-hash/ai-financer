import { prisma } from '../../lib/prisma';
import { BadRequestError } from '../../shared/core/errors';
import { TransactionService } from '../transactions/service';
import { AIActionPolicy } from './policy';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';
import { AIMemoryService } from './ai-memory.service';
import { AITrainingService } from './ai-training.service';
import { ProductEventsService } from '../analytics/product-events.service';
import { AIPreviewBuilder } from './ai-preview.builder';
import { AIExecutorService } from './ai-executor.service';
import { extractAmountFromText, normalizeAmount, stripAmountFromText } from './utils/amount-normalizer';

const transactionService = new TransactionService();

type RepeatCommand = { isRepeat: boolean; amount?: number };

type AccountUpdateTarget = {
  accountName?: string;
  accountBalance?: number;
  newName?: string;
  type?: string;
  currency?: string;
  showInTotalBalance?: boolean;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
};

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
      const normalizedCommand = command.trim();

      await this.events.track({
        userId,
        event: 'ai_command_received',
        data: { commandLength: command.length },
      });

      await this.memory.saveMessage({ userId, role: 'user', content: command });

      const repeatCommand = this.parseRepeatCommand(normalizedCommand);
      if (repeatCommand.isRepeat) {
        const repeatResult = await this.repeatLastTransaction(userId, repeatCommand.amount);
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      const deterministicAccountUpdate = this.parseAccountUpdateCommand(normalizedCommand);
      if (deterministicAccountUpdate) {
        const result = await this.handleAccountUpdate(userId, deterministicAccountUpdate);
        await this.logSuccess(userId, command, result, startedAt);
        return result;
      }

      const deterministicMultiActions = this.parseDeterministicMultiActions(normalizedCommand);
      if (deterministicMultiActions.length > 1) {
        const result = await this.executeMultiActions(userId, command, deterministicMultiActions, execute, confirmed, startedAt);
        await this.logSuccess(userId, command, result, startedAt);
        return result;
      }

      const history = await this.memory.getRecentMessages(userId, 8);
      const parsedCommand = await this.parser.parse(command, history);

      if (parsedCommand.intent === 'repeat_last') {
        const repeatResult = await this.repeatLastTransaction(userId);
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      if (parsedCommand.intent === 'multi_action') {
        const result = await this.executeMultiActions(userId, command, parsedCommand.actions, execute, confirmed, startedAt);
        await this.logSuccess(userId, command, result, startedAt);
        return result;
      }

      const result = await this.handleSingleParsed(userId, command, parsedCommand, history, execute, confirmed, startedAt);
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

  private async handleSingleParsed(
    userId: string,
    command: string,
    parsedCommand: AIParsedCommand,
    history: Array<any>,
    execute: boolean,
    confirmed: boolean,
    startedAt: number,
  ): Promise<AIResult> {
    if (parsedCommand.intent === 'chat_response') {
      return {
        success: true,
        intent: 'chat_response',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: parsedCommand.message,
        parsed: { message: parsedCommand.message },
      };
    }

    if (parsedCommand.intent === 'update_account') {
      return this.handleAccountUpdate(userId, parsedCommand);
    }

    await this.applyContextFallback(parsedCommand, history);

    const policy = this.policy.evaluate(parsedCommand);

    if (!execute || (policy.requiresConfirmation && !confirmed)) {
      return this.preview.buildPreview(
        userId,
        parsedCommand,
        policy.requiresConfirmation,
        policy.riskLevel,
        policy.reason,
      );
    }

    return this.executor.execute(userId, parsedCommand, policy.riskLevel);
  }

  private async executeMultiActions(
    userId: string,
    command: string,
    actions: AIParsedCommand[],
    execute: boolean,
    confirmed: boolean,
    startedAt: number,
  ): Promise<AIResult> {
    const history = await this.memory.getRecentMessages(userId, 8);
    const executedResults: AIResult[] = [];
    const previewResults: AIResult[] = [];

    for (const action of actions) {
      if (action.intent === 'unknown' || action.intent === 'help') continue;

      const result = await this.handleSingleParsed(
        userId,
        command,
        action,
        history,
        execute,
        confirmed,
        startedAt,
      );

      if (result.requiresConfirmation && !result.executed) {
        previewResults.push(result);
        continue;
      }

      executedResults.push(result);
    }

    const allResults = [...executedResults, ...previewResults];

    if (allResults.length === 0) {
      return this.buildUnknownResult();
    }

    const executedCount = executedResults.filter((item) => item.executed).length;
    const previewCount = previewResults.length;
    const lines = allResults.map((item) => `• ${item.message.replace(/^✅\s*/, '')}`);

    return {
      success: allResults.every((item) => item.success),
      intent: 'multi_action',
      executed: executedCount > 0,
      requiresConfirmation: previewCount > 0,
      riskLevel: previewCount > 0 ? 'medium' : 'low',
      message:
        previewCount > 0
          ? `AI подготовил ${allResults.length} действий. Выполнено: ${executedCount}, требуют подтверждения: ${previewCount}.\n${lines.join('\n')}`
          : `✅ Выполнено операций: ${executedCount}.\n${lines.join('\n')}`,
      parsed: {
        actions: allResults.map((item) => item.parsed),
      },
      data: allResults.map((item) => item.data).filter(Boolean),
    };
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
    if (parsedCommand.intent !== 'expense' && parsedCommand.intent !== 'income') return;

    const currentCategory = String(parsedCommand.rawCategory ?? '').trim().toLowerCase();
    const shouldUsePreviousCategory =
      !currentCategory ||
      this.isRepeatLikeText(currentCategory) ||
      currentCategory === 'расход' ||
      currentCategory === 'доход';

    if (!shouldUsePreviousCategory) return;

    const previousAssistantMessages = [...history].reverse().filter((message) => message.role === 'assistant');

    for (const message of previousAssistantMessages) {
      const parsed = this.readParsedFromMemory(message);

      if (parsed && parsed.type === parsedCommand.intent && typeof parsed.categoryName === 'string' && parsed.categoryName.trim()) {
        parsedCommand.rawCategory = parsed.categoryName;

        if (!parsedCommand.description || this.isRepeatLikeText(String(parsedCommand.description))) {
          parsedCommand.description = parsed.categoryName;
        }

        return;
      }
    }
  }

  private async repeatLastTransaction(userId: string, amountOverride?: number): Promise<AIResult> {
    const lastTransaction = await prisma.transaction.findFirst({
      where: { userId, type: { in: ['expense', 'income'] } },
      include: { account: true, category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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
    const amount = amountOverride ?? lastTransaction.amount;

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

  private parseDeterministicMultiActions(command: string): AIParsedCommand[] {
    const normalized = command.toLowerCase().replace(/ё/g, 'е');

    if (
      normalized.includes('финансов') ||
      normalized.includes('накоп') ||
      normalized.includes('скоп') ||
      normalized.includes('перевод') ||
      normalized.includes('переведи') ||
      normalized.includes('создай счет') ||
      normalized.includes('создай счёт') ||
      normalized.includes('измени') ||
      normalized.includes('переимен')
    ) {
      return [];
    }

    const actions: AIParsedCommand[] = [];
    const pairPattern = /([а-яa-z][а-яa-z\s-]{1,40}?)\s+(\d+(?:[.,]\d+)?\s*(?:кк|к|k|тыс|тысяч|тысячи|млн|миллион(?:а|ов)?)?|чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?=\s*(?:,|;|\n|\s+и\s+|$))/gi;

    for (const match of command.matchAll(pairPattern)) {
      const rawCategory = this.cleanMultiCategory(match[1]);
      const amount = normalizeAmount(match[2]);
      if (!rawCategory || !amount) continue;

      const isIncome = /зарплат|доход|аванс|кэшбек|кешбек|вернул|вернули|пришло|получил|получила/i.test(rawCategory);

      actions.push({
        intent: isIncome ? 'income' : 'expense',
        amount,
        rawCategory: isIncome ? this.cleanIncomeCategory(rawCategory) : rawCategory,
        description: isIncome ? this.cleanIncomeCategory(rawCategory) : rawCategory,
      });
    }

    return actions.length > 1 ? actions : [];
  }

  private cleanMultiCategory(value: string) {
    return value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/(^|\s)(и|а|плюс|еще|ещё|также|тоже)\s+/gi, ' ')
      .replace(/\b(расход|потратил|потратила|купил|купила|оплатил|оплатила|за|на)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanIncomeCategory(value: string) {
    const cleaned = value
      .replace(/\b(доход|получил|получила|пришло|пришла|зачислили)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || 'доход';
  }

  private parseAccountUpdateCommand(command: string): AccountUpdateTarget | null {
    const normalized = command.trim().toLowerCase().replace(/ё/g, 'е');

    if (!/(измени|изменить|переименуй|переименовать|запрети|разреши|заблокируй|разблокируй)/.test(normalized)) {
      return null;
    }

    if (!/(счет|счёт|карта|карту|аккаунт)/.test(normalized)) {
      return null;
    }

    const accountBalance = extractAmountFromText(normalized) ?? undefined;
    const nameMatch = command.match(/(?:счет|счёт|карту|карта|с названием|под названием)\s+["«]?([^"»]+?)["»]?(?:\s+на\s+|\s+в\s+|$)/i);
    const targetName = nameMatch?.[1]?.trim().replace(/^названи[ея]\s+/i, '');
    const newNameMatch = command.match(/(?:на\s+название|название\s+на|переименуй.*?\s+в|измени.*?\s+на)\s+["«]?([^"»]+)["»]?$/i);
    const newName = newNameMatch?.[1]?.trim().replace(/^названи[ея]\s+/i, '');

    const value: AccountUpdateTarget = {
      accountName: targetName,
      accountBalance,
      newName,
    };

    const wantsDisable = /(запрети|заблокируй|запрещай)/.test(normalized);
    const wantsEnable = /(разреши|разблокируй)/.test(normalized);

    if (/(переимен|назван)/.test(normalized) && wantsDisable) value.lockRename = true;
    if (/(переимен|назван)/.test(normalized) && wantsEnable) value.lockRename = false;
    if (/(трат|расход|списан)/.test(normalized) && wantsDisable) value.lockSpending = true;
    if (/(трат|расход|списан)/.test(normalized) && wantsEnable) value.lockSpending = false;
    if (/(перевод|переводы|переводить)/.test(normalized) && wantsDisable) value.lockTransfers = true;
    if (/(перевод|переводы|переводить)/.test(normalized) && wantsEnable) value.lockTransfers = false;
    if (/(баланс)/.test(normalized) && wantsDisable) value.lockBalance = true;
    if (/(баланс)/.test(normalized) && wantsEnable) value.lockBalance = false;

    const hasChanges =
      value.newName ||
      value.lockRename !== undefined ||
      value.lockSpending !== undefined ||
      value.lockTransfers !== undefined ||
      value.lockBalance !== undefined ||
      value.lockVisibility !== undefined;

    return hasChanges ? value : null;
  }

  private async handleAccountUpdate(userId: string, input: AccountUpdateTarget): Promise<AIResult> {
    const candidates = await prisma.account.findMany({
      where: {
        userId,
        ...(typeof input.accountBalance === 'number' ? { balance: input.accountBalance } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const normalizedName = input.accountName?.toLowerCase().trim();
    const matched = normalizedName
      ? candidates.filter((account) => {
          const name = account.name.toLowerCase();
          return name === normalizedName || name.includes(normalizedName) || normalizedName.includes(name);
        })
      : candidates;

    if (matched.length === 0) {
      return {
        success: false,
        intent: 'update_account',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: '🤔 Не нашёл счёт для изменения. Укажи название счёта или сумму на нём.',
        parsed: input as Record<string, unknown>,
      };
    }

    if (matched.length > 1) {
      return {
        success: false,
        intent: 'update_account',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'medium',
        message: `Нашёл несколько счетов. Уточни, какой именно:\n${matched
          .map((item) => `• ${item.name} — ${item.balance} ${item.currency} (${item.type})`)
          .join('\n')}`,
        parsed: input as Record<string, unknown>,
        data: matched,
      };
    }

    const account = matched[0];
    const data: Record<string, unknown> = {};

    if (input.newName) data.name = input.newName;
    if (input.type) data.type = input.type;
    if (input.currency) data.currency = input.currency;
    if (input.showInTotalBalance !== undefined) data.showInTotalBalance = input.showInTotalBalance;
    if (input.lockRename !== undefined) data.lockRename = input.lockRename;
    if (input.lockSpending !== undefined) data.lockSpending = input.lockSpending;
    if (input.lockTransfers !== undefined) data.lockTransfers = input.lockTransfers;
    if (input.lockBalance !== undefined) data.lockBalance = input.lockBalance;
    if (input.lockVisibility !== undefined) data.lockVisibility = input.lockVisibility;

    const updated = await prisma.account.update({
      where: { id: account.id },
      data,
    });

    return {
      success: true,
      intent: 'update_account',
      executed: true,
      requiresConfirmation: false,
      riskLevel: 'medium',
      message: `✅ Обновил счёт «${updated.name}».`,
      parsed: {
        accountId: account.id,
        oldName: account.name,
        ...data,
      },
      data: updated,
    };
  }

  private buildUnknownResult(): AIResult {
    return {
      success: false,
      intent: 'unknown',
      executed: false,
      requiresConfirmation: false,
      riskLevel: 'low',
      message:
        '🤔 Не понял команду. Попробуй: «кофе 350», «зарплата 50к», «кофе 300, такси 500 и зарплата 50к», «покажи счета».',
      parsed: null,
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

  private parseRepeatCommand(command: string): RepeatCommand {
    const normalized = this.normalizeRepeatText(command);
    if (!normalized || !this.isRepeatLikeText(normalized)) return { isRepeat: false };

    const amount = extractAmountFromText(normalized);
    return amount && amount > 0 ? { isRepeat: true, amount } : { isRepeat: true };
  }

  private isRepeatLikeText(value: string) {
    const normalized = this.normalizeRepeatText(value);
    if (!normalized) return false;

    const words = normalized.split(' ').filter(Boolean);
    if (words.length > 6) return false;

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
