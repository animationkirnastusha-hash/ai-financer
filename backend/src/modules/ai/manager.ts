import { prisma } from '../../lib/prisma';
import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { CategoryService } from '../categories/service';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import {
  categoryAliases,
  categoryColors,
  categoryIcons,
  normalizeCategoryName,
  toTitleCase,
} from './catalog';
import { AIActionPolicy } from './policy';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';

const transactionService = new TransactionService();
const accountService = new AccountService();
const categoryService = new CategoryService();

export class AIManager {
  private readonly parser = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();

  async handle(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    const execute = options?.execute ?? true;
    const confirmed = options?.confirmed ?? false;

   const parsedCommand = await this.parser.parse(command);
    const policy = this.policy.evaluate(parsedCommand);

    if (!execute || (policy.requiresConfirmation && !confirmed)) {
      return this.buildPreview(
        userId,
        parsedCommand,
        policy.requiresConfirmation,
        policy.riskLevel,
        policy.reason
      );
    }

    return this.execute(userId, parsedCommand, policy.riskLevel);
  }

  private async buildPreview(
    userId: string,
    parsedCommand: AIParsedCommand,
    requiresConfirmation: boolean,
    riskLevel: 'low' | 'medium' | 'high',
    reason?: string
  ): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'help':
        return {
          success: true,
          intent: 'help',
          executed: false,
          requiresConfirmation: false,
          riskLevel,
          message:
            '🤖 Я умею:\n• «кофе 350» — добавить расход\n• «+50000 зарплата» — добавить доход\n• «перевёл 5000 на наличные» — перевод между счетами\n• «покажи счета» — список счетов\n• «создай категорию такси расход» — создать категорию\n• «создай счёт Копилка savings RUB 1000» — создать счёт',
          parsed: null,
        };

      case 'show_accounts': {
        const summary = await accountService.getAccountsSummary(userId);
        const lines = summary.accounts.map(
          (account) => `${account.icon ?? '💳'} ${account.name}: ${account.balance} ${account.currency}`
        );

        return {
          success: true,
          intent: 'show_accounts',
          executed: false,
          requiresConfirmation: false,
          riskLevel,
          message: lines.length > 0 ? `💳 Ваши счета:\n${lines.join('\n')}` : 'У вас пока нет счетов.',
          parsed: null,
          data: summary,
        };
      }

      case 'stats': {
        const category = parsedCommand.rawCategory
          ? await this.findCategoryByName(userId, parsedCommand.rawCategory, parsedCommand.type)
          : null;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const result = await transactionService.getUserTransactions(userId, {
          type: parsedCommand.type,
          categoryId: category?.id,
          startDate: monthStart,
          endDate: now,
          limit: 200,
          offset: 0,
        });

        const total = result.transactions.reduce((sum, item) => sum + item.amount, 0);

        return {
          success: true,
          intent: 'stats',
          executed: false,
          requiresConfirmation: false,
          riskLevel,
          message: parsedCommand.rawCategory
            ? `📊 За текущий месяц по категории «${parsedCommand.rawCategory}»: ${total} ₽ (${result.transactions.length} операций).`
            : `📊 За текущий месяц: ${total} ₽ (${result.transactions.length} операций).`,
          parsed: {
            type: parsedCommand.type,
            category: parsedCommand.rawCategory ?? null,
            startDate: monthStart.toISOString(),
            endDate: now.toISOString(),
          },
          data: {
            total,
            count: result.transactions.length,
            transactions: result.transactions,
          },
        };
      }

      case 'expense': {
        const account = await this.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');

        return {
          success: true,
          intent: 'expense',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: requiresConfirmation
            ? `Найден крупный расход: ${parsedCommand.amount} ₽, категория «${category.name}». Подтверди выполнение.`
            : `Готов записать расход ${parsedCommand.amount} ₽ в категорию «${category.name}».`,
          parsed: {
  type: 'income',
  amount: parsedCommand.amount,
  accountId: account.id,
  accountName: account.name,
  categoryId: category.id,
  categoryName: category.name,
  description: parsedCommand.description ?? parsedCommand.rawCategory,

          },
        };
      }
     case 'financial_planning': {
  const monthlyIncome = parsedCommand.monthlyIncome ?? 0;
  const monthlyExpenses = parsedCommand.monthlyExpenses ?? 0;
  const targetAmount = parsedCommand.targetAmount ?? 0;

  const monthlyFreeCash = Math.max(monthlyIncome - monthlyExpenses, 0);

  const monthsNeeded =
    monthlyFreeCash > 0 && targetAmount > 0
      ? Math.ceil(targetAmount / monthlyFreeCash)
      : null;

  const message =
    monthlyFreeCash <= 0
      ? 'AI подготовил базовую финансовую модель. Сейчас свободный остаток не получается: расходы равны доходу или выше.'
      : monthsNeeded
        ? `AI подготовил базовую финансовую модель: свободный остаток около ${monthlyFreeCash} ₽ в месяц. На цель ${targetAmount} ₽ понадобится примерно ${monthsNeeded} мес.`
        : `AI подготовил базовую финансовую модель: свободный остаток около ${monthlyFreeCash} ₽ в месяц.`;

  return {
    success: true,
    intent: 'financial_planning',
    executed: false,
    requiresConfirmation: false,
    riskLevel: 'low',
    message,
    parsed: {
      monthlyIncome,
      monthlyExpenses,
      monthlyFreeCash,
      targetAmount,
      targetDateText: parsedCommand.targetDateText,
      monthsNeeded,
      question: parsedCommand.question,
    },
    data: {
      monthlyIncome,
      monthlyExpenses,
      monthlyFreeCash,
      targetAmount,
      targetDateText: parsedCommand.targetDateText,
      monthsNeeded,
      question: parsedCommand.question,
    },
  };
}
      case 'income': {
        const account = await this.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');

        return {
          success: true,
          intent: 'income',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: `Готов записать доход ${parsedCommand.amount} ₽ в категорию «${category.name}».`,
          parsed: {
  type: 'income',
  amount: parsedCommand.amount,
  accountId: account.id,
  accountName: account.name,
  categoryId: category.id,
  categoryName: category.name,
  description: parsedCommand.description ?? parsedCommand.rawCategory,

          },
        };
      }

      case 'transfer': {
        const resolved = await this.resolveTransfer(userId, parsedCommand);

        return {
          success: true,
          intent: 'transfer',
          executed: false,
          requiresConfirmation: true,
          riskLevel,
          message: `Подтверди перевод ${parsedCommand.amount} ₽ со счёта «${resolved.fromAccount.name}» на «${resolved.toAccount.name}».`,
          parsed: {
            type: 'transfer',
            amount: parsedCommand.amount,
            accountId: resolved.fromAccount.id,
            accountName: resolved.fromAccount.name,
            toAccountId: resolved.toAccount.id,
            toAccountName: resolved.toAccount.name,
            description: `Перевод на ${resolved.toAccount.name}`,
            reason: reason ?? null,
          },
        };
      }

      case 'create_category':
        return {
          success: true,
          intent: 'create_category',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: `Готов создать категорию «${parsedCommand.name}» (${parsedCommand.type}).`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
            icon: parsedCommand.type === 'income' ? '💰' : '📝',
            color: parsedCommand.type === 'income' ? '#00ffaa' : '#ff6b6b',
          },
        };

      case 'create_account':
        return {
          success: true,
          intent: 'create_account',
          executed: false,
          requiresConfirmation: true,
          riskLevel,
          message: `Подтверди создание счёта «${parsedCommand.name}» (${parsedCommand.currency}).`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
            currency: parsedCommand.currency,
            balance: parsedCommand.balance,
            showInTotalBalance: true,
            icon: '💳',
            color: '#5B8DEF',
            reason: reason ?? null,
          },
        };

      default:
        return {
          success: false,
          intent: 'unknown',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message:
            '🤔 Не понял команду. Попробуй: «кофе 350», «+50000 зарплата», «перевёл 5000 на наличные», «покажи счета».',
          parsed: null,
        };
    }
  }

  private async execute(
    userId: string,
    parsedCommand: AIParsedCommand,
    riskLevel: 'low' | 'medium' | 'high'
  ): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'expense': {
        const account = await this.getDefaultAccount(userId);
        const category = await this.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');

        const transaction = await transactionService.createTransaction(userId, {
          accountId: account.id,
          categoryId: category.id,
          amount: parsedCommand.amount,
          type: 'expense',
          description: parsedCommand.description ?? parsedCommand.rawCategory,
          isAIGenerated: true,
        });

        return {
          success: true,
          intent: 'expense',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✅ Записал расход: ${category.icon ?? '📝'} ${category.name} — ${parsedCommand.amount} ₽.`,
          parsed: {
            type: 'expense',
            amount: parsedCommand.amount,
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            description: parsedCommand.description ?? parsedCommand.rawCategory,
          },
          data: transaction,
        };
      }
      case 'financial_planning': {
  const monthlyIncome = parsedCommand.monthlyIncome ?? 0;
  const monthlyExpenses = parsedCommand.monthlyExpenses ?? 0;
  const targetAmount = parsedCommand.targetAmount ?? 0;

  const monthlyFreeCash = Math.max(monthlyIncome - monthlyExpenses, 0);

  const monthsNeeded =
    monthlyFreeCash > 0 && targetAmount > 0
      ? Math.ceil(targetAmount / monthlyFreeCash)
      : null;

  const message =
    monthlyFreeCash <= 0
      ? 'По базовой модели сейчас не получается копить: расходы равны доходу или выше. Нужно снизить расходы или увеличить доход.'
      : monthsNeeded
        ? `Базовая модель: при доходе ${monthlyIncome} ₽ и расходах ${monthlyExpenses} ₽ ты можешь откладывать около ${monthlyFreeCash} ₽ в месяц. На цель ${targetAmount} ₽ понадобится примерно ${monthsNeeded} мес.`
        : `Базовая модель: свободный остаток около ${monthlyFreeCash} ₽ в месяц.`;

  return {
    success: true,
    intent: 'financial_planning',
    executed: false,
    requiresConfirmation: false,
    riskLevel: 'low',
    message,
    parsed: {
      monthlyIncome,
      monthlyExpenses,
      monthlyFreeCash,
      targetAmount,
      targetDateText: parsedCommand.targetDateText,
      monthsNeeded,
      question: parsedCommand.question,
    },
    data: {
      monthlyIncome,
      monthlyExpenses,
      monthlyFreeCash,
      targetAmount,
      targetDateText: parsedCommand.targetDateText,
      monthsNeeded,
    },
  };
}
      case 'income': {
        const account = await this.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');

        const transaction = await transactionService.createTransaction(userId, {
          accountId: account.id,
          categoryId: category.id,
          amount: parsedCommand.amount,
          type: 'income',
          description: parsedCommand.description ?? parsedCommand.rawCategory,
          isAIGenerated: true,
        });

        return {
          success: true,
          intent: 'income',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✅ Записал доход: ${category.icon ?? '💰'} ${category.name} — ${parsedCommand.amount} ₽.`,
          parsed: {
  type: 'income',
  amount: parsedCommand.amount,
  accountId: account.id,
  accountName: account.name,
  categoryId: category.id,
  categoryName: category.name,
  description: parsedCommand.description ?? parsedCommand.rawCategory,

          },
          data: transaction,
        };
      }

      case 'transfer': {
        const resolved = await this.resolveTransfer(userId, parsedCommand);

        const transaction = await transactionService.createTransaction(userId, {
          accountId: resolved.fromAccount.id,
          toAccountId: resolved.toAccount.id,
          amount: parsedCommand.amount,
          type: 'transfer',
          description: `Перевод на ${resolved.toAccount.name}`,
          isAIGenerated: true,
        });

        return {
          success: true,
          intent: 'transfer',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✅ Перевёл ${parsedCommand.amount} ₽ со счёта «${resolved.fromAccount.name}» на «${resolved.toAccount.name}».`,
          parsed: {
            type: 'transfer',
            amount: parsedCommand.amount,
            accountId: resolved.fromAccount.id,
            accountName: resolved.fromAccount.name,
            toAccountId: resolved.toAccount.id,
            toAccountName: resolved.toAccount.name,
            description: `Перевод на ${resolved.toAccount.name}`,
          },
          data: transaction,
        };
      }

      case 'create_category': {
        const category = await categoryService.createCategory(userId, {
          name: parsedCommand.name,
          type: parsedCommand.type,
          icon: parsedCommand.type === 'income' ? '💰' : '📝',
          color: parsedCommand.type === 'income' ? '#00ffaa' : '#ff6b6b',
        });

        return {
          success: true,
          intent: 'create_category',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✨ Категория «${category.name}» создана.`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
          },
          data: category,
        };
      }

      case 'create_account': {
        const account = await accountService.createAccount(userId, {
          name: parsedCommand.name,
          type: parsedCommand.type,
          currency: parsedCommand.currency,
          balance: parsedCommand.balance,
          showInTotalBalance: true,
          icon: '💳',
          color: '#5B8DEF',
        });

        return {
          success: true,
          intent: 'create_account',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✅ Счёт «${account.name}» создан.`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
            currency: parsedCommand.currency,
            balance: parsedCommand.balance,
          },
          data: account,
        };
      }

      default:
        return this.buildPreview(userId, parsedCommand, false, riskLevel);
    }
  }
private async resolveAccountForMoneyFlow(
    userId: string,
    accountName: string | undefined,
  ) {
    if (!accountName) {
      return this.getDefaultAccount(userId);
    }

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    const account = this.findAccountByName(accounts, accountName);

    if (!account) {
      throw new NotFoundError(`Не найден счёт «${accountName}»`);
    }

    return account;
  }
  private async getDefaultAccount(userId: string) {
    const account = await prisma.account.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!account) {
      throw new NotFoundError('У пользователя нет ни одного счёта');
    }

    return account;
  }

  private async findCategoryByName(userId: string, rawName: string, type: 'income' | 'expense') {
    const normalized = normalizeCategoryName(rawName);

    const categories = await prisma.category.findMany({
      where: { userId, type },
      orderBy: [{ createdAt: 'asc' }],
    });

    return categories.find((item) => {
      const lower = item.name.toLowerCase();
      return lower === normalized.toLowerCase() || lower.includes(normalized.toLowerCase());
    });
  }

  private async findOrCreateCategory(userId: string, rawName: string, type: 'income' | 'expense') {
    const normalizedName = normalizeCategoryName(rawName);
    const existing = await this.findCategoryByName(userId, normalizedName, type);

    if (existing) {
      return existing;
    }

    const resolvedName = categoryAliases[normalizedName.toLowerCase()] ?? toTitleCase(normalizedName);
    const icon = categoryIcons[resolvedName] ?? (type === 'income' ? '💰' : '📝');

    return categoryService.createCategory(userId, {
      name: resolvedName,
      type,
      icon,
      color: categoryColors[type],
    });
  }

  private async resolveTransfer(
    userId: string,
    parsedCommand: Extract<AIParsedCommand, { intent: 'transfer' }>
  ) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (accounts.length < 2) {
      throw new BadRequestError('Для перевода нужно минимум два счёта');
    }

    const toAccount = this.findAccountByName(accounts, parsedCommand.toAccountName);
    if (!toAccount) {
      throw new NotFoundError(`Не найден счёт «${parsedCommand.toAccountName}»`);
    }

    const fromAccount = parsedCommand.fromAccountName
      ? this.findAccountByName(accounts, parsedCommand.fromAccountName)
      : accounts.find((item) => item.id !== toAccount.id);

    if (!fromAccount) {
      throw new NotFoundError(
        parsedCommand.fromAccountName
          ? `Не найден счёт «${parsedCommand.fromAccountName}»`
          : 'Не удалось определить исходный счёт'
      );
    }

    if (fromAccount.id === toAccount.id) {
      throw new BadRequestError('Нельзя перевести на тот же счёт');
    }

    return { fromAccount, toAccount };
  }

  private findAccountByName(accounts: Array<{ id: string; name: string }>, rawName: string) {
    const normalized = rawName.trim().toLowerCase();

    return accounts.find((account) => {
      const name = account.name.toLowerCase();
      return name === normalized || name.includes(normalized) || normalized.includes(name);
    });
  }
}