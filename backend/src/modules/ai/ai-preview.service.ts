import { AIParsedCommand, AIValidatedAction } from './types';

const TOOL_LABELS: Record<string, string> = {
  create_account: 'Создать счёт',
  update_account: 'Изменить счёт',
  delete_account: 'Удалить счёт',
  create_transaction: 'Добавить операцию',
  transfer_money: 'Перевести деньги',
  create_category: 'Создать категорию',
  update_category: 'Изменить категорию',
  delete_category: 'Удалить категорию',
  create_section: 'Создать раздел',
  update_section: 'Изменить раздел',
  delete_section: 'Удалить раздел',
  assign_category_to_section: 'Привязать категорию к разделу',
  show_accounts: 'Показать счета',
  show_transactions: 'Показать операции',
};

export class AIPreviewService {
  buildParsed(summary: string, actions: AIValidatedAction[]): AIParsedCommand {
    return { intent: 'batch', summary, actions };
  }

  buildMessage(parsed: AIParsedCommand) {
    if (parsed.actions.length === 0) return 'Я не нашёл действий для выполнения.';

    if (parsed.actions.length === 1) {
      const action = parsed.actions[0];
      return `Проверь: ${TOOL_LABELS[action.tool] ?? action.tool}.`;
    }

    return `Проверь ${parsed.actions.length} действия перед выполнением.`;
  }
}
