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

    if (command.intent === 'update_account') {
      return {
        requiresConfirmation: true,
        riskLevel: 'medium',
        reason: 'Изменение счёта требует подтверждения',
      };
    }

    if (command.intent === 'chat_response') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
      };
    }

    if (command.intent === 'multi_action') {
      return {
        requiresConfirmation: false,
        riskLevel: 'medium',
        reason: 'Пакет действий выполняется по отдельным правилам',
      };
    }

    if (command.intent === 'repeat_last') {
      return {
        requiresConfirmation: false,
        riskLevel: 'low',
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