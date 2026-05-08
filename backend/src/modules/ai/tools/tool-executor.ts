import { TransactionService } from '../../transactions/service';
import { AccountService } from '../../accounts/service';
import { CategoryService } from '../../categories/service';
import { SectionService } from '../../sections/service';
import { AIResolverService } from '../ai-resolver.service';
import type { AIParsedAtomicCommand, AIParsedCommand, AIResult, AIRiskLevel } from '../types';

const transactionService = new TransactionService();
const accountService = new AccountService();
const categoryService = new CategoryService();
const sectionService = new SectionService();

export class AIToolExecutor {
  private readonly resolver = new AIResolverService();

  async executePlan(userId: string, command: AIParsedCommand, riskLevel: AIRiskLevel): Promise<AIResult> {
    if (command.intent !== 'batch') {
      return this.executeAtomic(userId, command, riskLevel);
    }

    const results: AIResult[] = [];

    for (const action of command.actions) {
      if (action.intent === 'unknown' || action.intent === 'help' || action.intent === 'advice') {
        continue;
      }

      results.push(await this.executeAtomic(userId, action, riskLevel));
    }

    const failed = results.find((result) => !result.success);
    if (failed) return failed;

    return {
      success: true,
      intent: 'batch',
      executed: true,
      requiresConfirmation: false,
      riskLevel,
      message: this.buildBatchMessage(results),
      parsed: {
        summary: command.summary ?? null,
        actions: command.actions,
        results: results.map((result) => result.parsed),
      },
      data: results.map((result) => result.data),
    };
  }

  async executeAtomic(userId: string, parsedCommand: AIParsedAtomicCommand, riskLevel: AIRiskLevel): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'expense': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');
        const section = parsedCommand.sectionName
          ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName)
          : null;

        const transaction = await transactionService.createTransaction(userId, {
          accountId: account.id,
          categoryId: category.id,
          sectionId: section?.id ?? category.sectionId ?? null,
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
          message: `Записал расход ${parsedCommand.amount} ₽: ${category.name}.`,
          parsed: {
            type: 'expense',
            amount: parsedCommand.amount,
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            sectionId: section?.id ?? category.sectionId ?? null,
            sectionName: section?.name ?? null,
            description: parsedCommand.description ?? parsedCommand.rawCategory,
          },
          data: transaction,
        };
      }

      case 'income': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');
        const section = parsedCommand.sectionName
          ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName)
          : null;

        const transaction = await transactionService.createTransaction(userId, {
          accountId: account.id,
          categoryId: category.id,
          sectionId: section?.id ?? category.sectionId ?? null,
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
          message: `Записал доход ${parsedCommand.amount} ₽: ${category.name}.`,
          parsed: {
            type: 'income',
            amount: parsedCommand.amount,
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            sectionId: section?.id ?? category.sectionId ?? null,
            sectionName: section?.name ?? null,
            description: parsedCommand.description ?? parsedCommand.rawCategory,
          },
          data: transaction,
        };
      }

      case 'transfer': {
        const resolved = await this.resolver.resolveTransfer(userId, parsedCommand);
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
          message: `Перевёл ${parsedCommand.amount} ₽ со счёта «${resolved.fromAccount.name}» на «${resolved.toAccount.name}».`,
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

      case 'create_account': {
        const account = await accountService.createAccount(userId, {
          name: parsedCommand.name,
          type: parsedCommand.type,
          currency: parsedCommand.currency,
          balance: parsedCommand.balance,
          showInTotalBalance: true,
          icon: parsedCommand.type === 'cash' ? '💵' : '💳',
          color: '#5B8DEF',
        });

        return {
          success: true,
          intent: 'create_account',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `Создал счёт «${account.name}».`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
            currency: parsedCommand.currency,
            balance: parsedCommand.balance,
          },
          data: account,
        };
      }

      case 'create_category': {
        const section = parsedCommand.sectionName
          ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName)
          : null;

        const category = await categoryService.createCategory(userId, {
          name: parsedCommand.name,
          type: parsedCommand.type,
          icon: parsedCommand.type === 'income' ? '💰' : '📝',
          color: parsedCommand.type === 'income' ? '#00ffaa' : '#ff6b6b',
          sectionId: section?.id ?? null,
        });

        return {
          success: true,
          intent: 'create_category',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: section
            ? `Создал категорию «${category.name}» в разделе «${section.name}».`
            : `Создал категорию «${category.name}».`,
          parsed: {
            name: category.name,
            type: category.type,
            sectionId: section?.id ?? null,
            sectionName: section?.name ?? null,
          },
          data: category,
        };
      }

      case 'create_section': {
        const section = await sectionService.createSection(userId, { name: parsedCommand.name });
        return {
          success: true,
          intent: 'create_section',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `Создал раздел «${section.name}».`,
          parsed: { name: section.name },
          data: section,
        };
      }

      case 'assign_expenses_to_section': {
        const result = await sectionService.assignMatchingExpensesToSection(userId, {
          rawQuery: parsedCommand.rawQuery,
          sectionName: parsedCommand.sectionName,
        });

        return {
          success: true,
          intent: 'assign_expenses_to_section',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message:
            result.updatedCount > 0
              ? `Перенёс ${result.updatedCount} расходов в раздел «${result.section.name}».`
              : `Раздел «${result.section.name}» готов, но подходящих расходов пока не нашёл.`,
          parsed: {
            rawQuery: parsedCommand.rawQuery,
            sectionId: result.section.id,
            sectionName: result.section.name,
            updatedCount: result.updatedCount,
          },
          data: result,
        };
      }

      case 'update_settings':
        return {
          success: true,
          intent: 'update_settings',
          executed: false,
          requiresConfirmation: false,
          riskLevel,
          message: `Я понял настройку «${parsedCommand.key}». Подключение изменения этой настройки через AI уже заложено в engine.`,
          parsed: {
            key: parsedCommand.key,
            value: parsedCommand.value,
            status: 'foundation_ready',
          },
        };

      default:
        return {
          success: false,
          intent: 'unknown',
          executed: false,
          requiresConfirmation: false,
          riskLevel: 'low',
          message: 'Я понял запрос не полностью. Напиши сумму, счёт или действие чуть конкретнее — я сделаю базовую часть.',
          parsed: null,
        };
    }
  }

  private buildBatchMessage(results: AIResult[]) {
    const lines = results.map((result) => `• ${result.message.replace(/^✅\s*/u, '')}`);
    return `Готово, я выполнил ${results.length} действия:\n${lines.join('\n')}`;
  }
}
