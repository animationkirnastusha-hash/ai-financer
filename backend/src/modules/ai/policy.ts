import { AIParsedCommand } from './types';

export class AIActionPolicy {
  evaluate(command: AIParsedCommand): {
    requiresConfirmation: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reason?: string;
  } {
    if (command.intent === 'batch') {
      const childPolicies = command.actions.map((action) => this.evaluate(action));
      const requiresConfirmation = childPolicies.some((item) => item.requiresConfirmation);
      const riskLevel = childPolicies.some((item) => item.riskLevel === 'high')
        ? 'high'
        : childPolicies.some((item) => item.riskLevel === 'medium')
          ? 'medium'
          : 'low';

      return {
        requiresConfirmation,
        riskLevel,
        reason: requiresConfirmation ? 'В запросе есть действия, которые требуют подтверждения' : undefined,
      };
    }

    if (command.intent === 'delete_account') {
      return { requiresConfirmation: true, riskLevel: 'high', reason: 'Удаление счёта требует подтверждения' };
    }

    if (command.intent === 'delete_all_accounts') {
      return { requiresConfirmation: true, riskLevel: 'high', reason: 'Удаление всех счетов требует подтверждения' };
    }

    if (command.intent === 'clear_history') {
      return { requiresConfirmation: true, riskLevel: 'high', reason: 'Очистка истории требует подтверждения' };
    }

    if (command.intent === 'expense') {
      if (command.amount >= 10_000) {
        return { requiresConfirmation: true, riskLevel: 'medium', reason: 'Крупный расход требует подтверждения' };
      }
      return { requiresConfirmation: false, riskLevel: 'low' };
    }

    if (command.intent === 'transfer') {
      return { requiresConfirmation: true, riskLevel: 'medium', reason: 'Перевод между счетами требует подтверждения' };
    }

    if (command.intent === 'update_account') {
      return { requiresConfirmation: true, riskLevel: 'medium', reason: 'Изменение счёта требует подтверждения' };
    }

    if (command.intent === 'create_account') {
      return { requiresConfirmation: true, riskLevel: 'medium', reason: 'Создание счёта требует подтверждения' };
    }

    if (command.intent === 'income' || command.intent === 'advice' || command.intent === 'repeat_last') {
      return { requiresConfirmation: false, riskLevel: 'low' };
    }

    if (command.intent === 'create_category' || command.intent === 'create_section' || command.intent === 'assign_expenses_to_section') {
      return { requiresConfirmation: false, riskLevel: 'low' };
    }

    return { requiresConfirmation: false, riskLevel: 'low' };
  }
}
