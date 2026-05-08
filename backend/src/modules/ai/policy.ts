import { AIParsedCommand } from './types';

export class AIActionPolicy {
  evaluate(command: AIParsedCommand): {
    requiresConfirmation: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reason?: string;
  } {
    if (command.intent === 'batch') {
      const policies = command.actions.map((action) => this.evaluate(action));
      const highestRisk = policies.some((item) => item.riskLevel === 'high')
        ? 'high'
        : policies.some((item) => item.riskLevel === 'medium')
          ? 'medium'
          : 'low';

      return {
        requiresConfirmation: policies.some((item) => item.requiresConfirmation),
        riskLevel: highestRisk,
        reason: policies.find((item) => item.reason)?.reason ?? 'Составное действие AI',
      };
    }

    if (command.intent === 'expense') {
      if (command.amount >= 10_000) {
        return {
          requiresConfirmation: true,
          riskLevel: 'medium',
          reason: 'Крупный расход требует подтверждения',
        };
      }

      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    if (command.intent === 'income') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    if (command.intent === 'transfer') {
      return {
        requiresConfirmation: true,
        riskLevel: 'medium',
        reason: 'Перевод между счетами требует подтверждения',
      };
    }

    if (command.intent === 'create_account') {
      return {
        requiresConfirmation: true,
        riskLevel: 'medium',
        reason: 'Создание счёта требует подтверждения',
      };
    }

    if (command.intent === 'advice') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    if (command.intent === 'repeat_last') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    if (command.intent === 'create_category' || command.intent === 'create_section' || command.intent === 'assign_expenses_to_section') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    return {
      requiresConfirmation: false,
      riskLevel: 'low',
    };
  }
}