import type { AIParsedCommand } from '../types';

function formatAmount(amount?: number) {
  if (!amount) return '';
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
}

function describeAtomic(command: Exclude<AIParsedCommand, { intent: 'batch' }>) {
  switch (command.intent) {
    case 'create_account':
      return `создать счёт «${command.name}»`;
    case 'income':
      return `добавить доход ${formatAmount(command.amount)}${command.accountName ? ` на «${command.accountName}»` : ''}`;
    case 'expense':
      return `записать расход ${formatAmount(command.amount)}${command.rawCategory ? `: ${command.rawCategory}` : ''}`;
    case 'transfer':
      return `перевести ${formatAmount(command.amount)}${command.fromAccountName ? ` с «${command.fromAccountName}»` : ''} на «${command.toAccountName}»`;
    case 'create_section':
      return `создать раздел «${command.name}»`;
    case 'create_category':
      return `создать категорию «${command.name}»${command.sectionName ? ` в разделе «${command.sectionName}»` : ''}`;
    case 'assign_expenses_to_section':
      return `перенести «${command.rawQuery}» в раздел «${command.sectionName}»`;
    case 'show_accounts':
      return 'открыть счета';
    case 'stats':
      return 'показать статистику';
    case 'financial_planning':
      return 'подготовить базовый финансовый план';
    case 'advice':
      return 'ответить как финансовый помощник';
    case 'repeat_last':
      return 'повторить последнее действие';
    default:
      return 'обработать запрос';
  }
}

export function buildToolResponseText(command: AIParsedCommand) {
  if (command.intent === 'unknown') {
    return 'Я понял общий смысл, но мне не хватает деталей. Уточни сумму, счёт или действие.';
  }

  if (command.intent === 'help') {
    return 'Можешь писать обычным языком: расходы, доходы, переводы, счета, категории, разделы и настройки.';
  }

  if (command.intent === 'batch') {
    const parts = command.actions.map((action) => describeAtomic(action));

    if (parts.length === 0) {
      return 'Понял. Проверь детали перед подтверждением.';
    }

    return `Понял: ${parts.join('; ')}. Проверь детали и подтверди.`;
  }

  return `Понял: ${describeAtomic(command)}. Проверь детали и подтверди.`;
}
