import type { AIParsedCommand } from '../types';

function formatAmount(amount?: number) {
  if (!amount) return '';
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
}

function describeAtomic(command: Exclude<AIParsedCommand, { intent: 'batch' }>) {
  switch (command.intent) {
    case 'create_account':
      return `создам счёт «${command.name}»`;
    case 'income':
      return `добавлю доход ${formatAmount(command.amount)}${command.accountName ? ` на «${command.accountName}»` : ''}`;
    case 'expense':
      return `запишу расход ${formatAmount(command.amount)}${command.rawCategory ? `: ${command.rawCategory}` : ''}`;
    case 'transfer':
      return `переведу ${formatAmount(command.amount)}${command.fromAccountName ? ` с «${command.fromAccountName}»` : ''} на «${command.toAccountName}»`;
    case 'create_section':
      return `создам раздел «${command.name}»`;
    case 'create_category':
      return `создам категорию «${command.name}»${command.sectionName ? ` в разделе «${command.sectionName}»` : ''}`;
    case 'assign_expenses_to_section':
      return `перенесу «${command.rawQuery}» в раздел «${command.sectionName}»`;
    case 'show_accounts':
      return 'открою счета';
    case 'stats':
      return 'покажу статистику';
    case 'financial_planning':
      return 'подготовлю базовый финансовый план';
    case 'advice':
      return 'отвечу как финансовый помощник';
    case 'repeat_last':
      return 'повторю последнее действие';
    default:
      return 'обработаю запрос';
  }
}

export function buildToolResponseText(command: AIParsedCommand) {
  if (command.intent === 'unknown') {
    return 'Я понял, что нужно что-то сделать с финансами, но мне не хватает деталей. Уточни сумму, счёт или действие.';
  }

  if (command.intent === 'help') {
    return 'Можешь писать обычным языком: расходы, доходы, переводы, счета, категории, разделы и настройки.';
  }

  if (command.intent === 'batch') {
    const parts = command.actions.map((action) => describeAtomic(action));
    return `Понял. Я выполню: ${parts.join('; ')}.`;
  }

  return `Понял: ${describeAtomic(command)}.`;
}
