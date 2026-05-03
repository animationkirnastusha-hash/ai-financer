import type { AIParseResult } from '@/features/chat/model/chat.types';

function formatAmount(value: unknown) {
  if (typeof value !== 'number') return null;
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

export function formatAIMessage(result: AIParseResult) {
  const parsed = result.parsed ?? {};
  const amount = formatAmount(parsed.amount);
  const categoryName =
    typeof parsed.categoryName === 'string' ? parsed.categoryName : null;
  const description =
    typeof parsed.description === 'string' ? parsed.description : null;

  if (result.intent === 'expense') {
    if (result.executed && amount) {
      return `Записал расход ${amount}${categoryName ? ` · ${categoryName}` : ''}.`;
    }

    if (!result.executed && amount) {
      return `Подготовил расход ${amount}${categoryName ? ` · ${categoryName}` : ''}${description ? ` · ${description}` : ''}.`;
    }
  }

  if (result.intent === 'income') {
    if (result.executed && amount) {
      return `Записал доход ${amount}.`;
    }

    if (!result.executed && amount) {
      return `Подготовил доход ${amount}.`;
    }
  }

  if (result.intent === 'transfer') {
    if (result.executed && amount) {
      return `Выполнил перевод ${amount}.`;
    }

    if (!result.executed && amount) {
      return `Подготовил перевод ${amount}.`;
    }
  }

  return result.message;
}