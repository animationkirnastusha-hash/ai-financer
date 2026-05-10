import { prisma } from '../../lib/prisma';
import { CategoryService } from '../categories/service';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
const categoryAliases: Record<string, string> = {
  кофе: 'Кафе',
  кафе: 'Кафе',
  cappuccino: 'Кафе',
  капучино: 'Кафе',
  латте: 'Кафе',
  еда: 'Еда',
  продукты: 'Еда',
  обед: 'Еда',
  ужин: 'Еда',
  завтрак: 'Еда',
  ресторан: 'Еда',
  такси: 'Такси',
  taxi: 'Такси',
  транспорт: 'Транспорт',
  метро: 'Транспорт',
  автобус: 'Транспорт',
  зарплата: 'Зарплата',
  аванс: 'Зарплата',
  доход: 'Зарплата',
  премия: 'Зарплата',
  фриланс: 'Зарплата',
};

const categoryIcons: Record<string, string> = {
  Кафе: '☕',
  Еда: '🍕',
  Такси: '🚕',
  Транспорт: '🚗',
  Зарплата: '💰',
};

const categoryColors: Record<'expense' | 'income', string> = {
  expense: '#ff6b6b',
  income: '#00ffaa',
};

function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeCategoryName(raw: string) {
  const cleaned = raw.trim().toLowerCase();
  return categoryAliases[cleaned] ?? cleaned;
}
import { AIParsedCommand } from './types';

const categoryService = new CategoryService();

type AccountLike = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance?: number;
  showInTotalBalance?: boolean;
  createdAt?: Date;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«»]/g, '')
    .replace(/\b(?:счет|счёт|счета|счёта|карта|карту|карты|кошелек|кошелёк|аккаунт|account|wallet|безналичный|безналичная|безнал|банковский|банковская)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function currencyHint(value: string): string | null {
  const raw = value.toLowerCase();
  if (/(?:\$|usd|доллар|бакс)/.test(raw)) return 'USD';
  if (/(?:€|eur|евро)/.test(raw)) return 'EUR';
  if (/(?:₽|rub|руб)/.test(raw)) return 'RUB';
  if (/(?:₫|vnd|донг)/.test(raw)) return 'VND';
  return null;
}



function accountTypeHint(value: string): string | null {
  const raw = value.toLowerCase().replace(/ё/g, 'е');
  if (/(?:безнал|банк|банковск|card|карта|карту)/.test(raw)) return 'card';
  if (/(?:налич|cash|кэш)/.test(raw)) return 'cash';
  if (/(?:накоп|сбереж|saving)/.test(raw)) return 'savings';
  if (/(?:инвест|invest|broker|брокер)/.test(raw)) return 'investment';
  return null;
}

function accountPriority(account: AccountLike) {
  let score = 0;
  if (account.showInTotalBalance !== false) score += 10;
  if (account.type === 'cash') score += 5;
  if (account.type === 'card') score += 4;
  if (account.type === 'savings') score += 3;
  if (String(account.currency).toUpperCase() === 'RUB') score += 2;
  return score;
}

function sortAccounts(accounts: AccountLike[]) {
  return [...accounts].sort((a, b) => {
    const priorityDiff = accountPriority(b) - accountPriority(a);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
}

export class AIResolverService {
  async resolveAccountForMoneyFlow(userId: string, accountName: string | undefined) {
    if (!accountName?.trim()) return this.getDefaultAccount(userId);

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    const account = this.findAccountByName(accounts, accountName);
    if (!account) throw new NotFoundError(`Не найден счёт «${accountName}»`);
    return account;
  }

  async getDefaultAccount(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    const account = sortAccounts(accounts)[0];
    if (!account) throw new NotFoundError('У пользователя нет ни одного счёта');
    return account;
  }

  async findCategoryByName(userId: string, rawName: string, type: 'income' | 'expense') {
    const normalized = normalizeCategoryName(rawName || (type === 'income' ? 'доход' : 'расход'));
    const categories = await prisma.category.findMany({
      where: { userId, type },
      orderBy: [{ createdAt: 'asc' }],
    });

    const normalizedLower = normalized.toLowerCase();
    return categories.find((item) => {
      const lower = item.name.toLowerCase();
      return lower === normalizedLower || lower.includes(normalizedLower) || normalizedLower.includes(lower);
    });
  }

  async findOrCreateCategory(userId: string, rawName: string, type: 'income' | 'expense') {
    const normalizedName = normalizeCategoryName(rawName || (type === 'income' ? 'доход' : 'расход'));
    const existing = await this.findCategoryByName(userId, normalizedName, type);
    if (existing) return existing;

    const resolvedName = categoryAliases[normalizedName.toLowerCase()] ?? toTitleCase(normalizedName);
    const icon = categoryIcons[resolvedName] ?? (type === 'income' ? '💰' : '📝');

    return categoryService.createCategory(userId, {
      name: resolvedName,
      type,
      icon,
      color: categoryColors[type],
    });
  }

  async resolveAccountByNameOrHint(userId: string, accountName: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    const account = this.findAccountByName(accounts, accountName);
    if (!account) throw new NotFoundError(`Не найден счёт «${accountName}»`);
    return account;
  }

  async resolveTransfer(userId: string, parsedCommand: Extract<AIParsedCommand, { intent: 'transfer' }>) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (accounts.length < 2) throw new BadRequestError('Для перевода нужно минимум два счёта');

    const toAccount = this.findAccountByName(accounts, parsedCommand.toAccountName);
    if (!toAccount) throw new NotFoundError(`Не найден счёт «${parsedCommand.toAccountName}»`);

    const fromAccount = parsedCommand.fromAccountName
      ? this.findAccountByName(accounts, parsedCommand.fromAccountName)
      : sortAccounts(accounts).find((item) => item.id !== toAccount.id);

    if (!fromAccount) {
      throw new NotFoundError(
        parsedCommand.fromAccountName
          ? `Не найден счёт «${parsedCommand.fromAccountName}»`
          : 'Не удалось определить исходный счёт',
      );
    }

    if (fromAccount.id === toAccount.id) throw new BadRequestError('Нельзя перевести на тот же счёт');
    return { fromAccount, toAccount };
  }

  private findAccountByName(accounts: AccountLike[], rawName: string) {
    const normalized = normalizeName(rawName);
    const hint = currencyHint(rawName);

    const byExactName = accounts.find((account) => normalizeName(account.name) === normalized);
    if (byExactName) return byExactName;

    const bySoftName = accounts.find((account) => {
      const name = normalizeName(account.name);
      return Boolean(name && normalized && (name.includes(normalized) || normalized.includes(name)));
    });
    if (bySoftName) return bySoftName;

    if (hint) {
      const byCurrency = sortAccounts(accounts).find((account) => String(account.currency).toUpperCase() === hint);
      if (byCurrency) return byCurrency;
    }

    const typeHint = accountTypeHint(rawName);
    if (typeHint) {
      const byType = sortAccounts(accounts).find((account) => account.type === typeHint);
      if (byType) return byType;
    }

    return undefined;
  }
}
