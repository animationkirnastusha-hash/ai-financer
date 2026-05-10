import { AIActionPolicyResult, AIParsedCommand } from './types';

export class AIActionPolicy {
  evaluate(command: AIParsedCommand): AIActionPolicyResult {
    if (command.intent === 'batch') {
      const results = command.actions.map((action) => this.evaluate(action));
      const high = results.some((item) => item.riskLevel === 'high');
      const medium = results.some((item) => item.riskLevel === 'medium');
      const requiresConfirmation = results.some((item) => item.requiresConfirmation);

      return {
        canExecute: true,
        requiresConfirmation,
        riskLevel: high ? 'high' : medium ? 'medium' : 'low',
        reason: requiresConfirmation ? 'Пакет содержит действия, требующие подтверждения.' : undefined,
      };
    }

    switch (command.intent) {
      case 'delete_all_accounts':
        return { canExecute: true, requiresConfirmation: true, riskLevel: 'high', reason: 'Удаление всех счетов — необратимое массовое действие.' };

      case 'clear_history':
        return { canExecute: true, requiresConfirmation: true, riskLevel: 'high', reason: 'Очистка истории удаляет финансовые операции и влияет на балансы.' };

      case 'transfer':
        return { canExecute: true, requiresConfirmation: true, riskLevel: command.amount >= 10000 ? 'high' : 'medium', reason: 'Перевод между счетами требует проверки.' };

      case 'expense':
        return { canExecute: true, requiresConfirmation: command.amount >= 10000, riskLevel: command.amount >= 10000 ? 'medium' : 'low', reason: command.amount >= 10000 ? 'Крупный расход.' : undefined };

      case 'income':
        return { canExecute: true, requiresConfirmation: false, riskLevel: 'low' };

      case 'create_account':
        return { canExecute: true, requiresConfirmation: true, riskLevel: 'medium', reason: 'Создание счёта меняет структуру финансов.' };

      case 'create_category':
      case 'create_section':
      case 'assign_expenses_to_section':
      case 'update_settings':
        return { canExecute: true, requiresConfirmation: true, riskLevel: 'medium' };

      case 'show_accounts':
      case 'stats':
      case 'financial_planning':
      case 'advice':
      case 'repeat_last':
      case 'help':
      case 'unknown':
      default:
        return { canExecute: true, requiresConfirmation: false, riskLevel: 'low' };
    }
  }
}
