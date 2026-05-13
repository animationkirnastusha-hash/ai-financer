import { AccountService } from '../accounts/service';
import { CategoryService } from '../categories/service';
import { SectionService } from '../sections/service';
import { TransactionService } from '../transactions/service';
import { AIParsedCommand, AIValidatedAction } from './types';
import { prisma } from '../../lib/prisma';

const accountService = new AccountService();
const transactionService = new TransactionService();
const categoryService = new CategoryService();
const sectionService = new SectionService();

export class AIExecutorService {
  async execute(userId: string, parsed: AIParsedCommand) {
    const results: unknown[] = [];
    const createdAccountNames = new Map<string, string>();

    for (const action of parsed.actions) {
      const result = await this.executeAction(userId, action, createdAccountNames);
      results.push(result);
    }

    return {
      summary: parsed.summary,
      actionsCount: parsed.actions.length,
      results,
    };
  }

  private async executeAction(userId: string, action: AIValidatedAction, createdAccountNames: Map<string, string>) {
    const input = action.input;
    const resolved = action.resolved ?? {};

    if (action.tool === 'create_account') {
      if (typeof resolved.existingAccountId === 'string') {
        const account = await accountService.getAccountById(userId, resolved.existingAccountId);
        createdAccountNames.set(String(input.name).toLowerCase(), account.id);
        return { tool: action.tool, account, skipped: true, reason: 'account_already_exists' };
      }

      const account = await accountService.createAccount(userId, {
        name: String(input.name),
        type: String(input.type ?? 'cash'),
        currency: String(input.currency ?? 'RUB'),
        balance: Number(input.initialBalance ?? 0),
      });
      createdAccountNames.set(String(input.name).toLowerCase(), account.id);
      return { tool: action.tool, account };
    }

    if (action.tool === 'update_account') {
      const accountId = String(resolved.accountId);
      const account = await accountService.updateAccount(userId, accountId, {
        ...(input.name ? { name: String(input.name) } : {}),
        ...(input.type ? { type: String(input.type) } : {}),
        ...(input.currency ? { currency: String(input.currency) } : {}),
        ...(input.balance !== null && input.balance !== undefined ? { balance: Number(input.balance) } : {}),
      });
      return { tool: action.tool, account };
    }

    if (action.tool === 'delete_account') {
      const account = await accountService.deleteAccount(userId, String(resolved.accountId));
      return { tool: action.tool, account };
    }

    if (action.tool === 'create_transaction') {
      const pendingAccountName = typeof resolved.pendingAccountName === 'string' ? resolved.pendingAccountName : '';
      const accountId = typeof resolved.accountId === 'string'
        ? resolved.accountId
        : pendingAccountName
          ? createdAccountNames.get(pendingAccountName.toLowerCase())
          : undefined;

      if (!accountId) {
        throw new Error('Cannot execute transaction: account was not resolved');
      }

      const amount = Number(resolved.amountInAccountCurrency ?? input.amount);
      const categoryId = await this.findOrCreateCategoryId(userId, {
        name: typeof input.category === 'string' ? input.category : '',
        type: input.kind === 'income' ? 'income' : 'expense',
        sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
      });

      const transaction = await transactionService.createTransaction(userId, {
        accountId,
        amount,
        type: input.kind === 'income' ? 'income' : 'expense',
        categoryId,
        sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
        description: typeof input.description === 'string' && input.description.trim()
          ? input.description.trim()
          : input.kind === 'income'
            ? 'Пополнение счёта'
            : 'Расход',
        isAIGenerated: true,
      });
      return { tool: action.tool, transaction };
    }

    if (action.tool === 'transfer_money') {
      const transaction = await transactionService.createTransaction(userId, {
        accountId: String(resolved.fromAccountId),
        toAccountId: String(resolved.toAccountId),
        amount: Number(resolved.amountInFromCurrency ?? input.amount),
        type: 'transfer',
        description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : 'Перевод между счетами',
        isAIGenerated: true,
      });
      return { tool: action.tool, transaction };
    }

    if (action.tool === 'create_category') {
      const category = await categoryService.createCategory(userId, {
        name: String(input.name),
        type: input.type === 'income' ? 'income' : 'expense',
        sectionId: typeof resolved.sectionId === 'string' ? resolved.sectionId : null,
      });
      return { tool: action.tool, category };
    }

    if (action.tool === 'create_section') {
      const section = await sectionService.createSection(userId, { name: String(input.name) });
      return { tool: action.tool, section };
    }

    if (action.tool === 'show_accounts') {
      const accounts = await accountService.getUserAccounts(userId);
      return { tool: action.tool, accounts };
    }

    if (action.tool === 'show_transactions') {
      const transactions = await transactionService.getUserTransactions(userId, { limit: Number(input.limit ?? 20) });
      return { tool: action.tool, transactions };
    }

    return { tool: action.tool, skipped: true };
  }

  private async findOrCreateCategoryId(userId: string, params: { name: string; type: 'income' | 'expense'; sectionId?: string | null }) {
    const name = params.name.trim();
    if (!name) return null;

    const existing = await prisma.category.findFirst({
      where: { userId, name },
    });

    if (existing) return existing.id;

    const created = await categoryService.createCategory(userId, {
      name,
      type: params.type,
      sectionId: params.sectionId ?? null,
    });

    return created.id;
  }
}
