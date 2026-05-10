import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { AIParsedCommand, AIResult } from './types';
import { AIResolverService } from './ai-resolver.service';

const transactionService = new TransactionService();
const accountService = new AccountService();

function money(amount: number, currency?: string) {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'VND' ? '₫' : '₽';
  return `${amount} ${symbol}`;
}

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
      case 'batch': {
        const actionLabels = parsedCommand.actions.map((action, index) => {
          if (action.intent === 'create_account') return `${index + 1}. Создать счёт «${action.name}» (${action.type}, ${action.currency})`;
          if (action.intent === 'update_account') return `${index + 1}. Обновить счёт «${action.accountName}»`;
          if (action.intent === 'delete_account') return `${index + 1}. Удалить счёт «${action.accountName}»`;
          if (action.intent === 'income') return `${index + 1}. Пополнить${action.accountName ? ` «${action.accountName}»` : ''}: ${money(action.amount, action.currency)}`;
          if (action.intent === 'expense') return `${index + 1}. Записать расход ${money(action.amount, action.currency)}: ${action.rawCategory}`;
          if (action.intent === 'transfer') return `${index + 1}. Перевести ${money(action.amount, action.currency)}${action.fromAccountName ? ` с «${action.fromAccountName}»` : ''} на «${action.toAccountName}»`;
          if (action.intent === 'delete_all_accounts') return `${index + 1}. Удалить все счета`;
          if (action.intent === 'clear_history') return `${index + 1}. Очистить историю (${action.scope})`;
          if (action.intent === 'create_section') return `${index + 1}. Создать раздел «${action.name}»`;
          if (action.intent === 'create_category') return `${index + 1}. Создать категорию «${action.name}»`;
          if (action.intent === 'assign_expenses_to_section') return `${index + 1}. Перенести «${action.rawQuery}» в раздел «${action.sectionName}»`;
          return `${index + 1}. ${action.intent}`;
        });

        return {
          success: true,
          intent: 'batch',
          executed: false,
          requiresConfirmation,
          riskLevel,
          message: `${requiresConfirmation ? 'Проверь и подтверди' : 'Я подготовил'} ${parsedCommand.actions.length} действия:\n${actionLabels.join('\n')}`,
          parsed: { type: 'batch', actions: parsedCommand.actions, premiumSuggestion: parsedCommand.premiumSuggestion ?? null, reason: reason ?? null },
        };
      }

      case 'help':
        return { success: true, intent: 'help', executed: false, requiresConfirmation: false, riskLevel, message: 'Напиши обычным языком, что сделать с деньгами: создать счёт, записать расход, пополнить счёт, перевести деньги, создать раздел или категорию.', parsed: null };

      case 'show_accounts': {
        const summary = await accountService.getAccountsSummary(userId);
        const lines = summary.accounts.map((account) => `${account.icon ?? '💳'} ${account.name}: ${account.balance} ${account.currency}`);
        return { success: true, intent: 'show_accounts', executed: false, requiresConfirmation: false, riskLevel, message: lines.length > 0 ? `💳 Ваши счета:\n${lines.join('\n')}` : 'У вас пока нет счетов.', parsed: null, data: summary };
      }

      case 'stats': {
        const category = parsedCommand.rawCategory ? await this.resolver.findCategoryByName(userId, parsedCommand.rawCategory, parsedCommand.type) : null;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const result = await transactionService.getUserTransactions(userId, { type: parsedCommand.type, categoryId: category?.id, startDate: monthStart, endDate: now, limit: 200, offset: 0 });
        const total = result.transactions.reduce((sum, item) => sum + item.amount, 0);
        return { success: true, intent: 'stats', executed: false, requiresConfirmation: false, riskLevel, message: parsedCommand.rawCategory ? `📊 За текущий месяц по категории «${parsedCommand.rawCategory}»: ${total} ₽ (${result.transactions.length} операций).` : `📊 За текущий месяц: ${total} ₽ (${result.transactions.length} операций).`, parsed: { type: parsedCommand.type, category: parsedCommand.rawCategory ?? null, startDate: monthStart.toISOString(), endDate: now.toISOString() }, data: { total, count: result.transactions.length, transactions: result.transactions } };
      }

      case 'expense': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');
        return { success: true, intent: 'expense', executed: false, requiresConfirmation, riskLevel, message: requiresConfirmation ? `Подтверди расход ${money(parsedCommand.amount, parsedCommand.currency)}: «${category.name}» со счёта «${account.name}».` : `Готов записать расход ${money(parsedCommand.amount, parsedCommand.currency)} в «${category.name}».`, parsed: { type: 'expense', amount: parsedCommand.amount, currency: parsedCommand.currency ?? null, accountId: account.id, accountName: account.name, categoryId: category.id, categoryName: category.name, description: parsedCommand.description ?? parsedCommand.rawCategory } };
      }

      case 'income': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');
        return { success: true, intent: 'income', executed: false, requiresConfirmation, riskLevel, message: `Готов пополнить «${account.name}» на ${money(parsedCommand.amount, parsedCommand.currency)}.`, parsed: { type: 'income', amount: parsedCommand.amount, currency: parsedCommand.currency ?? null, accountId: account.id, accountName: account.name, categoryId: category.id, categoryName: category.name, description: parsedCommand.description ?? parsedCommand.rawCategory } };
      }

      case 'transfer': {
        const resolved = await this.resolver.resolveTransfer(userId, parsedCommand);
        return { success: true, intent: 'transfer', executed: false, requiresConfirmation: true, riskLevel, message: `Подтверди перевод ${money(parsedCommand.amount, parsedCommand.currency)} со счёта «${resolved.fromAccount.name}» на «${resolved.toAccount.name}».`, parsed: { type: 'transfer', amount: parsedCommand.amount, currency: parsedCommand.currency ?? null, accountId: resolved.fromAccount.id, accountName: resolved.fromAccount.name, toAccountId: resolved.toAccount.id, toAccountName: resolved.toAccount.name, description: parsedCommand.description ?? `Перевод на ${resolved.toAccount.name}` } };
      }

      case 'create_account':
        return { success: true, intent: 'create_account', executed: false, requiresConfirmation, riskLevel, message: `Подтверди создание счёта «${parsedCommand.name}» (${parsedCommand.type}, ${parsedCommand.currency}).`, parsed: { type: 'create_account', name: parsedCommand.name, accountType: parsedCommand.type, currency: parsedCommand.currency, balance: parsedCommand.balance, reason: reason ?? null } };

      case 'update_account':
        return { success: true, intent: 'update_account', executed: false, requiresConfirmation: true, riskLevel, message: `Подтверди изменение счёта «${parsedCommand.accountName}».`, parsed: { type: 'update_account', accountName: parsedCommand.accountName, name: parsedCommand.name ?? null, accountType: parsedCommand.type ?? null, currency: parsedCommand.currency ?? null, balance: parsedCommand.balance ?? null, showInTotalBalance: parsedCommand.showInTotalBalance ?? null, reason: reason ?? null } };

      case 'delete_account':
        return { success: true, intent: 'delete_account', executed: false, requiresConfirmation: true, riskLevel: 'high', message: `Опасное действие: удалить счёт «${parsedCommand.accountName}». Подтверди только если уверен.`, parsed: { type: 'delete_account', accountName: parsedCommand.accountName, reason: reason ?? null } };

      case 'delete_all_accounts':
        return { success: true, intent: 'delete_all_accounts', executed: false, requiresConfirmation: true, riskLevel: 'high', message: 'Опасное действие: удалить все счета и связанные операции. Подтверди только если уверен.', parsed: { type: 'delete_all_accounts', confirmScope: parsedCommand.confirmScope ?? 'accounts', reason: reason ?? null } };

      case 'clear_history':
        return { success: true, intent: 'clear_history', executed: false, requiresConfirmation: true, riskLevel: 'high', message: parsedCommand.scope === 'ai' ? 'Подтверди очистку AI-истории.' : parsedCommand.scope === 'all' ? 'Подтверди очистку всей истории: операции, AI-логи и ожидающие действия.' : 'Подтверди очистку истории операций. Балансы счетов будут пересчитаны.', parsed: { type: 'clear_history', scope: parsedCommand.scope, reason: reason ?? null } };

      case 'create_category':
        return { success: true, intent: 'create_category', executed: false, requiresConfirmation, riskLevel, message: `Создать категорию «${parsedCommand.name}»?`, parsed: { name: parsedCommand.name, categoryType: parsedCommand.type, sectionName: parsedCommand.sectionName ?? null } };

      case 'create_section':
        return { success: true, intent: 'create_section', executed: false, requiresConfirmation, riskLevel, message: `Создать раздел «${parsedCommand.name}»?`, parsed: { name: parsedCommand.name } };

      default:
        return { success: true, intent: parsedCommand.intent, executed: false, requiresConfirmation: false, riskLevel, message: 'Я понял запрос, но для этого действия пока нужен отдельный обработчик.', parsed: parsedCommand as unknown as Record<string, unknown> };
    }
  }
}
