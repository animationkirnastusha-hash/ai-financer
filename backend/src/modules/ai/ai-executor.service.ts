import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { CategoryService } from '../categories/service';
import { AIParsedCommand, AIResult } from './types';
import { AIResolverService } from './ai-resolver.service';
import { AIPreviewBuilder } from './ai-preview.builder';

const transactionService = new TransactionService();
const accountService = new AccountService();
const categoryService = new CategoryService();

export class AIExecutorService {
  private readonly resolver = new AIResolverService();
  private readonly preview = new AIPreviewBuilder();

  async execute(
    userId: string,
    parsedCommand: AIParsedCommand,
    riskLevel: 'low' | 'medium' | 'high'
  ): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'expense': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');

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

      case 'income': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');

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
        return this.preview.buildPreview(userId, parsedCommand, false, riskLevel);
    }
  }
}