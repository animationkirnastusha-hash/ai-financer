import { prisma } from '../../lib/prisma';
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

type SupportedCurrency = 'RUB' | 'USD' | 'EUR' | 'VND';

const BASE_RUB_RATES: Record<SupportedCurrency, number> = { RUB: 1, USD: 92, EUR: 100, VND: 0.0036 };

function normalizeCurrency(value: unknown, fallback: SupportedCurrency = 'RUB'): SupportedCurrency {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'USD' || raw === '$') return 'USD';
  if (raw === 'EUR' || raw === '€') return 'EUR';
  if (raw === 'VND' || raw === '₫') return 'VND';
  if (raw === 'RUB' || raw === '₽') return 'RUB';
  return fallback;
}

function convertAmount(amount: number, from: unknown, to: unknown): number {
  const fromCurrency = normalizeCurrency(from, normalizeCurrency(to));
  const toCurrency = normalizeCurrency(to, fromCurrency);
  if (fromCurrency === toCurrency) return amount;
  const amountInRub = amount * BASE_RUB_RATES[fromCurrency];
  const converted = amountInRub / BASE_RUB_RATES[toCurrency];
  return Math.round(converted * 100) / 100;
}

function currencySymbol(currency: unknown) {
  const normalized = normalizeCurrency(currency);
  if (normalized === 'USD') return '$';
  if (normalized === 'EUR') return '€';
  if (normalized === 'VND') return '₫';
  return '₽';
}

export class AIExecutorService {
  private readonly resolver = new AIResolverService();
  private readonly preview = new AIPreviewBuilder();

  async execute(userId: string, parsedCommand: AIParsedCommand, riskLevel: 'low' | 'medium' | 'high'): Promise<AIResult> {
    switch (parsedCommand.intent) {
      case 'batch': {
        const results: AIResult[] = [];
        for (const action of parsedCommand.actions) results.push(await this.execute(userId, action, riskLevel));
        const executedCount = results.filter((item) => item.executed).length;
        const failed = results.find((item) => !item.success);
        const summary = results.map((item, index) => `${index + 1}. ${item.message.replace(/^✅\s*/, '')}`).join('\n');
        return { success: !failed, intent: 'batch', executed: executedCount > 0, requiresConfirmation: false, riskLevel, message: failed ? `Я выполнил часть запроса, но один шаг требует правки:\n${summary}` : `Готово, выполнил ${executedCount} действия:\n${summary}`, parsed: { type: 'batch', actions: parsedCommand.actions, executedCount, premiumSuggestion: parsedCommand.premiumSuggestion ?? null }, data: results };
      }

      case 'expense': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const accountCurrency = normalizeCurrency((account as any).currency, 'RUB');
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'expense');
        const section = parsedCommand.sectionName ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName) : null;
        const amount = convertAmount(parsedCommand.amount, parsedCommand.currency, accountCurrency);
        const transaction = await transactionService.createTransaction(userId, { accountId: account.id, categoryId: category.id, sectionId: section?.id ?? category.sectionId ?? null, amount, type: 'expense', description: parsedCommand.description ?? parsedCommand.rawCategory, isAIGenerated: true });
        return { success: true, intent: 'expense', executed: true, requiresConfirmation: false, riskLevel, message: `✅ Записал расход: ${category.icon ?? '📝'} ${category.name} — ${amount} ${currencySymbol(accountCurrency)}.`, parsed: { type: 'expense', amount, originalAmount: parsedCommand.amount, originalCurrency: parsedCommand.currency ?? accountCurrency, accountId: account.id, accountName: account.name, categoryId: category.id, categoryName: category.name, sectionId: section?.id ?? category.sectionId ?? null, sectionName: section?.name ?? null, description: parsedCommand.description ?? parsedCommand.rawCategory }, data: transaction };
      }

      case 'income': {
        const account = await this.resolver.resolveAccountForMoneyFlow(userId, parsedCommand.accountName);
        const accountCurrency = normalizeCurrency((account as any).currency, 'RUB');
        const category = await this.resolver.findOrCreateCategory(userId, parsedCommand.rawCategory, 'income');
        const section = parsedCommand.sectionName ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName) : null;
        const amount = convertAmount(parsedCommand.amount, parsedCommand.currency, accountCurrency);
        const transaction = await transactionService.createTransaction(userId, { accountId: account.id, categoryId: category.id, sectionId: section?.id ?? category.sectionId ?? null, amount, type: 'income', description: parsedCommand.description ?? parsedCommand.rawCategory, isAIGenerated: true });
        return { success: true, intent: 'income', executed: true, requiresConfirmation: false, riskLevel, message: `✅ Записал доход: ${category.icon ?? '💰'} ${category.name} — ${amount} ${currencySymbol(accountCurrency)}.`, parsed: { type: 'income', amount, originalAmount: parsedCommand.amount, originalCurrency: parsedCommand.currency ?? accountCurrency, accountId: account.id, accountName: account.name, categoryId: category.id, categoryName: category.name, sectionId: section?.id ?? category.sectionId ?? null, sectionName: section?.name ?? null, description: parsedCommand.description ?? parsedCommand.rawCategory }, data: transaction };
      }

      case 'transfer': {
        const resolved = await this.resolver.resolveTransfer(userId, parsedCommand);
        const transaction = await transactionService.createTransaction(userId, { accountId: resolved.fromAccount.id, toAccountId: resolved.toAccount.id, amount: parsedCommand.amount, type: 'transfer', description: parsedCommand.description ?? `Перевод на ${resolved.toAccount.name}`, isAIGenerated: true });
        return { success: true, intent: 'transfer', executed: true, requiresConfirmation: false, riskLevel, message: `✅ Перевёл ${parsedCommand.amount} ₽ со счёта «${resolved.fromAccount.name}» на «${resolved.toAccount.name}».`, parsed: { type: 'transfer', amount: parsedCommand.amount, currency: parsedCommand.currency ?? null, accountId: resolved.fromAccount.id, accountName: resolved.fromAccount.name, toAccountId: resolved.toAccount.id, toAccountName: resolved.toAccount.name, description: parsedCommand.description ?? `Перевод на ${resolved.toAccount.name}` }, data: transaction };
      }

      case 'create_category': {
        const section = parsedCommand.sectionName ? await sectionService.findOrCreateSection(userId, parsedCommand.sectionName) : null;
        const category = await categoryService.createCategory(userId, { name: parsedCommand.name, type: parsedCommand.type, sectionId: section?.id, icon: parsedCommand.type === 'income' ? '💰' : '📝', color: parsedCommand.type === 'income' ? '#00ffaa' : '#ff6b6b' });
        return { success: true, intent: 'create_category', executed: true, requiresConfirmation: false, riskLevel, message: `✨ Категория «${category.name}» создана.`, parsed: { name: parsedCommand.name, type: parsedCommand.type, sectionName: parsedCommand.sectionName ?? null }, data: category };
      }

      case 'create_section': {
        const section = await sectionService.createSection(userId, { name: parsedCommand.name });
        return { success: true, intent: 'create_section', executed: true, requiresConfirmation: false, riskLevel, message: `🗂️ Раздел «${section.name}» создан.`, parsed: { name: section.name }, data: section };
      }

      case 'assign_expenses_to_section': {
        const result = await sectionService.assignMatchingExpensesToSection(userId, { rawQuery: parsedCommand.rawQuery, sectionName: parsedCommand.sectionName });
        return { success: true, intent: 'assign_expenses_to_section', executed: true, requiresConfirmation: false, riskLevel, message: result.updatedCount > 0 ? `✅ Перенёс ${result.updatedCount} расходов по запросу «${parsedCommand.rawQuery}» в раздел «${result.section.name}».` : `🗂️ Раздел «${result.section.name}» создан, но подходящих расходов по запросу «${parsedCommand.rawQuery}» пока не нашёл.`, parsed: { rawQuery: parsedCommand.rawQuery, sectionId: result.section.id, sectionName: result.section.name, updatedCount: result.updatedCount }, data: result };
      }

      case 'create_account': {
        const account = await accountService.createAccount(userId, { name: parsedCommand.name, type: parsedCommand.type, currency: parsedCommand.currency, balance: parsedCommand.balance, showInTotalBalance: true, icon: parsedCommand.type === 'cash' ? '💵' : '💳', color: '#5B8DEF' });
        return { success: true, intent: 'create_account', executed: true, requiresConfirmation: false, riskLevel, message: `✅ Счёт «${account.name}» создан.`, parsed: { name: parsedCommand.name, type: parsedCommand.type, currency: parsedCommand.currency, balance: parsedCommand.balance }, data: account };
      }

      case 'delete_all_accounts': {
        const result = await prisma.$transaction(async (tx) => {
          const [transactions, recurring, accounts] = await Promise.all([
            tx.transaction.deleteMany({ where: { userId } }),
            tx.recurringPayment.deleteMany({ where: { userId } }),
            tx.account.deleteMany({ where: { userId } }),
          ]);
          return { deletedTransactions: transactions.count, deletedRecurringPayments: recurring.count, deletedAccounts: accounts.count };
        });
        return { success: true, intent: 'delete_all_accounts', executed: true, requiresConfirmation: false, riskLevel, message: `✅ Удалил все счета: ${result.deletedAccounts}. Связанные операции: ${result.deletedTransactions}.`, parsed: { type: 'delete_all_accounts', ...result }, data: result };
      }

      case 'clear_history': {
        const result = await prisma.$transaction(async (tx) => {
          let transactions = { count: 0 };
          let auditLogs = { count: 0 };
          let pendingActions = { count: 0 };
          let aiMessages = { count: 0 };

          if (parsedCommand.scope === 'transactions' || parsedCommand.scope === 'all') {
            transactions = await tx.transaction.deleteMany({ where: { userId } });
            await tx.account.updateMany({ where: { userId }, data: { balance: 0 } });
          }

          if (parsedCommand.scope === 'ai' || parsedCommand.scope === 'all') {
            auditLogs = await tx.aIAuditLog.deleteMany({ where: { userId } });
            pendingActions = await tx.aIPendingAction.deleteMany({ where: { userId } });
            aiMessages = await tx.aIMessage.deleteMany({ where: { userId } });
          }

          return { scope: parsedCommand.scope, deletedTransactions: transactions.count, deletedAuditLogs: auditLogs.count, deletedPendingActions: pendingActions.count, deletedAIMessages: aiMessages.count };
        });
        return { success: true, intent: 'clear_history', executed: true, requiresConfirmation: false, riskLevel, message: parsedCommand.scope === 'ai' ? '✅ Очистил AI-историю.' : parsedCommand.scope === 'all' ? '✅ Очистил операции и AI-историю.' : '✅ Очистил историю операций и сбросил балансы счетов.', parsed: { type: 'clear_history', ...result }, data: result };
      }

      default:
        return this.preview.buildPreview(userId, parsedCommand, false, riskLevel);
    }
  }
}
