import { AIParsedCommand } from './types';

export class AIActionPolicy {
  evaluate(command: AIParsedCommand): {
    requiresConfirmation: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reason?: string;
  } {
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

    if (command.intent === 'create_category') {
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