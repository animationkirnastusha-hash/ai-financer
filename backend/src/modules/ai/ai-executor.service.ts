import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { CategoryService } from '../categories/service';
import { SectionService } from '../sections/service';
import { AIParsedCommand, AIResult } from './types';
import { AIResolverService } from './ai-resolver.service';
import { AIPreviewBuilder } from './ai-preview.builder';

const transactionService = new TransactionService();
const accountService = new AccountService();
const categoryService = new CategoryService();
const sectionService = new SectionService();

export class AIExecutorService {
  private readonly resolver = new AIResolverService();
  private readonly preview = new AIPreviewBuilder();

  async execute(
    userId: string,
    parsedCommand: AIParsedCommand,
    riskLevel: 'low' | 'medium' | 'high'
  ): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'batch': {
        const results: AIResult[] = [];

        for (const action of parsedCommand.actions) {
          const result = await this.execute(userId, action, riskLevel);
          results.push(result);
        }

        const executedCount = results.filter((result) => result.executed).length;
        const messages = results.map((result) => result.message.replace(/^✅\s*/u, '').replace(/^✨\s*/u, '').replace(/^🗂️\s*/u, ''));

        return {
          success: results.every((result) => result.success),
          intent: 'batch',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `✅ Сделал ${executedCount} действий: ${messages.join(' ')}`,
          parsed: {
            type: 'batch',
            summary: parsedCommand.summary ?? null,
            actions: results.map((result) => result.parsed),
          },
          data: results.map((result) => result.data),
        };
      }

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
          message: `✅ Записал расход: ${category.icon ?? '📝'} ${category.name} — ${parsedCommand.amount} ₽.`,
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
          message: `✅ Записал доход: ${category.icon ?? '💰'} ${category.name} — ${parsedCommand.amount} ₽.`,
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
          message: `✨ Категория «${category.name}» создана.`,
          parsed: {
            name: parsedCommand.name,
            type: parsedCommand.type,
            sectionId: section?.id ?? null,
            sectionName: section?.name ?? null,
          },
          data: category,
        };
      }

      case 'create_section': {
        const section = await sectionService.createSection(userId, {
          name: parsedCommand.name,
        });

        return {
          success: true,
          intent: 'create_section',
          executed: true,
          requiresConfirmation: false,
          riskLevel,
          message: `🗂️ Раздел «${section.name}» создан. Теперь в него можно складывать категории и расходы.`,
          parsed: {
            name: section.name,
          },
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
              ? `✅ Перенёс ${result.updatedCount} расходов по запросу «${parsedCommand.rawQuery}» в раздел «${result.section.name}».`
              : `🗂️ Раздел «${result.section.name}» создан, но подходящих расходов по запросу «${parsedCommand.rawQuery}» пока не нашёл.`,
          parsed: {
            rawQuery: parsedCommand.rawQuery,
            sectionId: result.section.id,
            sectionName: result.section.name,
            updatedCount: result.updatedCount,
          },
          data: result,
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
        return this.preview.buildPreview(userId, parsedCommand, false, riskLevel);
    }
  }
}