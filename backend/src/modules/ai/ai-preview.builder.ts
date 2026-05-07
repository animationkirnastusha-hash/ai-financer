import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { AIParsedCommand, AIResult } from './types';
import { AIResolverService } from './ai-resolver.service';

const transactionService = new TransactionService();
const accountService = new AccountService();

export class AIPreviewBuilder {
  private readonly resolver = new AIResolverService();

  async buildPreview(
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
          ? await this.resolver.findCategoryByName(userId, parsedCommand.rawCategory, parsedCommand.type)
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
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');

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
            type: 'expense',
            amount: parsedCommand.amount,
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            description: parsedCommand.description ?? parsedCommand.rawCategory,
          },
        };
      }

      case 'income': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');

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
        const resolved = await this.resolver.resolveTransfer(userId, parsedCommand);

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

      case 'financial_planning': {
        const monthlyIncome = parsedCommand.monthlyIncome ?? 0;
        const monthlyExpenses = parsedCommand.monthlyExpenses ?? 0;
        const targetAmount = parsedCommand.targetAmount ?? 0;
        const monthlyFreeCash = Math.max(monthlyIncome - monthlyExpenses, 0);

        const monthsNeeded =
          monthlyFreeCash > 0 && targetAmount > 0 ? Math.ceil(targetAmount / monthlyFreeCash) : null;

        return {
          success: true,
          intent: 'financial_planning',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message:
            monthlyFreeCash <= 0
              ? 'AI подготовил базовую финансовую модель. Сейчас свободный остаток не получается: расходы равны доходу или выше.'
              : monthsNeeded
                ? `AI подготовил базовую финансовую модель: свободный остаток около ${monthlyFreeCash} ₽ в месяц. На цель ${targetAmount} ₽ понадобится примерно ${monthsNeeded} мес.`
                : `AI подготовил базовую финансовую модель: свободный остаток около ${monthlyFreeCash} ₽ в месяц.`,
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

      case 'create_section':
        return {
          success: true,
          intent: 'create_section',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: `Готов создать раздел «${parsedCommand.name}».`,
          parsed: {
            name: parsedCommand.name,
          },
        };

      case 'assign_expenses_to_section':
        return {
          success: true,
          intent: 'assign_expenses_to_section',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: `Готов перенести расходы по запросу «${parsedCommand.rawQuery}» в раздел «${parsedCommand.sectionName}».`,
          parsed: {
            rawQuery: parsedCommand.rawQuery,
            sectionName: parsedCommand.sectionName,
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
}