import type { AIParsedCommand } from '../types';

export interface ToolValidationResult {
  ok: boolean;
  question?: string;
}

function validateAtomic(command: Exclude<AIParsedCommand, { intent: 'batch' }>): ToolValidationResult {
  switch (command.intent) {
    case 'income':
    case 'expense':
      if (!command.amount || command.amount <= 0) return { ok: false, question: 'Какую сумму записать?' };
      return { ok: true };

    case 'transfer':
      if (!command.amount || command.amount <= 0) return { ok: false, question: 'Какую сумму перевести?' };
      if (!command.toAccountName) return { ok: false, question: 'На какой счёт перевести?' };
      return { ok: true };

    case 'create_account':
      if (!command.name) return { ok: false, question: 'Как назвать счёт?' };
      return { ok: true };

    case 'create_section':
      if (!command.name) return { ok: false, question: 'Как назвать раздел?' };
      return { ok: true };

    case 'create_category':
      if (!command.name) return { ok: false, question: 'Как назвать категорию?' };
      return { ok: true };

    case 'assign_expenses_to_section':
      if (!command.rawQuery) return { ok: false, question: 'Какие расходы перенести?' };
      if (!command.sectionName) return { ok: false, question: 'В какой раздел перенести?' };
      return { ok: true };

    default:
      return { ok: true };
  }
}

export function validateToolCommand(command: AIParsedCommand): ToolValidationResult {
  if (command.intent === 'batch') {
    for (const action of command.actions) {
      const result = validateAtomic(action);
      if (!result.ok) return result;
    }
    return { ok: true };
  }

  return validateAtomic(command as Exclude<AIParsedCommand, { intent: 'batch' }>);
}
