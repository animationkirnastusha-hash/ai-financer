import { prisma } from '../../lib/prisma';
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
import { AIParsedCommand } from './types';

const accountService = new AccountService();
const categoryService = new CategoryService();

export class AIResolverService {
  async resolveAccountForMoneyFlow(userId: string, accountName: string | undefined) {
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

  async getDefaultAccount(userId: string) {
    const account = await prisma.account.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!account) {
      throw new NotFoundError('У пользователя нет ни одного счёта');
    }

    return account;
  }

  async findCategoryByName(userId: string, rawName: string, type: 'income' | 'expense') {
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

  async findOrCreateCategory(userId: string, rawName: string, type: 'income' | 'expense') {
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

  async resolveTransfer(userId: string, parsedCommand: Extract<AIParsedCommand, { intent: 'transfer' }>) {
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