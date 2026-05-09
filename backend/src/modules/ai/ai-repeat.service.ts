import { prisma } from '../../lib/prisma';
import { TransactionService } from '../transactions/service';
import { AIResult } from './types';

const transactionService = new TransactionService();

export type RepeatCommandParseResult = {
  isRepeat: boolean;
  amount?: number;
};

export class AIRepeatService {
  parseRepeatCommand(command: string): RepeatCommandParseResult {
    const normalized = this.normalizeRepeatText(command);

    if (!normalized || !this.isRepeatLikeText(normalized)) return { isRepeat: false };

    const amountMatch = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/);
    if (!amountMatch) return { isRepeat: true };

    const amount = Number(amountMatch[1].replace(',', '.'));
    return Number.isFinite(amount) && amount > 0 ? { isRepeat: true, amount } : { isRepeat: true };
  }

  async repeatLastTransaction(userId: string, amountOverride?: number): Promise<AIResult> {
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        userId,
        type: { in: ['expense', 'income'] },
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    if (!lastTransaction) {
      return {
        success: false,
        intent: 'unknown',
        executed: false,
        requiresConfirmation: false,
        riskLevel: 'low',
        message: '🤔 Не нашёл прошлую операцию, которую можно повторить.',
        parsed: null,
      };
    }

    const type = lastTransaction.type === 'income' ? 'income' : 'expense';
    const categoryName = lastTransaction.category?.name ?? lastTransaction.description ?? 'операция';
    const categoryIcon = lastTransaction.category?.icon ?? (type === 'income' ? '💰' : '📝');
    const amount = amountOverride ?? lastTransaction.amount;

    const transaction = await transactionService.createTransaction(userId, {
      accountId: lastTransaction.accountId,
      categoryId: lastTransaction.categoryId ?? undefined,
      amount,
      type,
      description: lastTransaction.description ?? categoryName,
      isAIGenerated: true,
    });

    return {
      success: true,
      intent: type,
      executed: true,
      requiresConfirmation: false,
      riskLevel: 'low',
      message:
        type === 'expense'
          ? `✅ Повторил расход: ${categoryIcon} ${categoryName} — ${amount} ₽.`
          : `✅ Повторил доход: ${categoryIcon} ${categoryName} — ${amount} ₽.`,
      parsed: {
        type,
        amount,
        accountId: lastTransaction.accountId,
        accountName: lastTransaction.account.name,
        categoryId: lastTransaction.categoryId,
        categoryName,
        description: lastTransaction.description ?? categoryName,
        repeatedFromTransactionId: lastTransaction.id,
      },
      data: transaction,
    };
  }

  isRepeatLikeText(value: string) {
    const normalized = this.normalizeRepeatText(value);
    if (!normalized) return false;

    const words = normalized.split(' ').filter(Boolean);
    if (words.length > 6) return false;

    return (
      /(^|\s)(еще|ещё)(\s|$)/.test(normalized) ||
      /(^|\s)(повтор\w*|повтори|повторить|повторяй)(\s|$)/.test(normalized) ||
      /(^|\s)(снова|опять)(\s|$)/.test(normalized) ||
      /(^|\s)(тоже|также)(\s|$)/.test(normalized) ||
      /(^|\s)то\s+же(\s|$)/.test(normalized) ||
      /(^|\s)так\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такую\s+же(\s|$)/.test(normalized) ||
      /(^|\s)такой\s+же(\s|$)/.test(normalized) ||
      /(^|\s)(дублируй|продублируй|дубль|продублировать)(\s|$)/.test(normalized)
    );
  }

  private normalizeRepeatText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,!?;:()[\]{}"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
