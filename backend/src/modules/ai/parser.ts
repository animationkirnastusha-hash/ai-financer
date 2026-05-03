import { BadRequestError } from '../../shared/core/errors';
import { AIParsedCommand } from './types';

type MoneyFlowType = 'income' | 'expense';

export class AIParser {
  parse(command: string): AIParsedCommand {
    const normalized = this.normalizeCommand(command);

    if (!normalized) {
      throw new BadRequestError('Command is required');
    }

    if (this.isHelp(normalized)) {
      return { intent: 'help' };
    }

    const showAccounts = this.tryShowAccounts(normalized);
    if (showAccounts) return showAccounts;

    const createCategory = this.tryCreateCategory(normalized);
    if (createCategory) return createCategory;

    const createAccount = this.tryCreateAccount(normalized);
    if (createAccount) return createAccount;

    const stats = this.tryStats(normalized);
    if (stats) return stats;

    const transfer = this.tryTransfer(normalized);
    if (transfer) return transfer;

    const income = this.tryIncome(normalized);
    if (income) return income;

    const expense = this.tryExpense(normalized);
    if (expense) return expense;

    return { intent: 'unknown' };
  }

  private normalizeCommand(command: string) {
    return command.trim().replace(/\s+/g, ' ');
  }

  private isHelp(command: string) {
    return ['help', 'помощь', '?', '/help'].includes(command.toLowerCase());
  }

  private tryShowAccounts(command: string) {
    if (!/^(покажи\s+)?(мои\s+)?сч[её]та$|^(мои\s+)?сч[её]та$/i.test(command)) {
      return null;
    }

    return { intent: 'show_accounts' as const };
  }

  private tryCreateCategory(command: string) {
    const match = command.match(
      /^создай\s+категорию\s+(.+?)(?:\s+(доход|расход|income|expense))?$/i
    );
    if (!match) return null;

    const rawName = match[1].trim();
    const rawType = (match[2] ?? 'расход').toLowerCase();
    const type: MoneyFlowType =
      rawType === 'доход' || rawType === 'income' ? 'income' : 'expense';

    return {
      intent: 'create_category' as const,
      name: rawName,
      type,
    };
  }

  private tryCreateAccount(command: string) {
    const match = command.match(
      /^создай\s+сч[её]т\s+(.+?)\s+(card|cash|bank|savings)(?:\s+(RUB|USD|EUR))?(?:\s+(\d+))?$/i
    );

    if (!match) return null;

    const [, rawName, rawType, rawCurrency, rawBalance] = match;

    return {
      intent: 'create_account' as const,
      name: rawName.trim(),
      type: rawType.toLowerCase(),
      currency: (rawCurrency ?? 'RUB').toUpperCase(),
      balance: rawBalance ? Number(rawBalance) : 0,
    };
  }

  private tryStats(command: string) {
    const match = command.match(/^сколько\s+(потратил|заработал)(?:\s+на\s+(.+))?$/i);
    if (!match) return null;

    const [, action, rawCategory] = match;
    const type: MoneyFlowType =
      action.toLowerCase() === 'заработал' ? 'income' : 'expense';

    return {
      intent: 'stats' as const,
      type,
      rawCategory: rawCategory?.trim(),
    };
  }

   private tryExpense(command: string) {
    const patterns = [
      /^([^\d+-][^0-9]+?)\s+(\d+)(?:\s+(.+))?$/i,
      /^потратил\s+(\d+)\s+на\s+(.+)$/i,
      /^-(\d+)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (!match) continue;

      let amount = 0;
      let rawCategory = '';
      let description: string | undefined;

      if (pattern.source.startsWith('^потратил')) {
        amount = Number(match[1]);
        rawCategory = match[2].trim();
      } else if (pattern.source.startsWith('^-')) {
        amount = Number(match[1]);
        rawCategory = match[2].trim();
      } else {
        rawCategory = match[1].trim();
        amount = Number(match[2]);
        description = match[3]?.trim();
      }

      const accountMatch = rawCategory.match(/^(.+?)\s+(?:с|со|из)\s+(.+)$/i);
      const accountName = accountMatch?.[2]?.trim();

      if (accountMatch) {
        rawCategory = accountMatch[1].trim();
        description = rawCategory;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestError('Invalid expense amount');
      }

      return {
        intent: 'expense' as const,
        amount,
        rawCategory,
        description: description ?? rawCategory,
        accountName,
      };
    }

    return null;
  }

  private tryIncome(command: string) {
    const patterns = [
      /^\+(\d+)\s+(.+)$/i,
      /^получил\s+(\d+)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (!match) continue;

      const amount = Number(match[1]);
      let rawCategory = match[2].trim();

      const accountMatch = rawCategory.match(/^(.+?)\s+(?:на|в)\s+(.+)$/i);
      const accountName = accountMatch?.[2]?.trim();

      if (accountMatch) {
        rawCategory = accountMatch[1].trim();
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestError('Invalid income amount');
      }

      return {
        intent: 'income' as const,
        amount,
        rawCategory,
        description: rawCategory,
        accountName,
      };
    }

    return null;
  }

  private tryTransfer(command: string) {
    const patterns = [
      /^перев[её]л\s+(\d+)\s+на\s+(.+)$/i,
      /^перев[её]л\s+(\d+)\s+с\s+(.+)\s+на\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (!match) continue;

      const amount = Number(match[1]);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestError('Invalid transfer amount');
      }

      if (match.length === 3) {
        return {
          intent: 'transfer' as const,
          amount,
          toAccountName: match[2].trim(),
        };
      }

      return {
        intent: 'transfer' as const,
        amount,
        fromAccountName: match[2].trim(),
        toAccountName: match[3].trim(),
      };
    }

    return null;
  }
}