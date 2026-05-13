import { AIParsedCommand, AIValidatedAction } from './types';

const TOOL_LABELS: Record<string, string> = {
  create_account: 'создать счёт',
  update_account: 'изменить счёт',
  delete_account: 'удалить счёт',
  create_transaction: 'добавить операцию',
  transfer_money: 'перевести деньги',
  create_category: 'создать категорию',
  update_category: 'изменить категорию',
  delete_category: 'удалить категорию',
  create_section: 'создать раздел',
  update_section: 'изменить раздел',
  delete_section: 'удалить раздел',
  assign_category_to_section: 'привязать категорию к разделу',
  show_accounts: 'показать счета',
  show_transactions: 'показать операции',
};

export class AIPreviewService {
  buildParsed(summary: string, actions: AIValidatedAction[]): AIParsedCommand {
    return { intent: 'batch', summary, actions };
  }

  buildMessage(parsed: AIParsedCommand) {
    if (parsed.actions.length === 0) return 'Я не нашёл действий для выполнения.';
    if (parsed.summary && !/^проверь действие/i.test(parsed.summary)) return `Проверь: ${parsed.summary}`;

    if (parsed.actions.length === 1) {
      return `Проверь: ${this.describeAction(parsed.actions[0])}`;
    }

    return `Проверь ${parsed.actions.length} действия перед выполнением.`;
  }

  buildExecutedMessage(parsed: AIParsedCommand) {
    if (parsed.actions.length === 1) return `Готово: ${this.describeAction(parsed.actions[0])}`;
    return `Готово. Выполнено действий: ${parsed.actions.length}.`;
  }

  private describeAction(action: AIValidatedAction) {
    const input = action.input ?? {};

    if (action.tool === 'create_transaction') {
      const kind = input.kind === 'income' ? 'доход' : 'расход';
      const amount = this.formatAmount(input.amount, input.currency);
      const name = this.clean(input.description || input.category) || 'операция';
      const account = this.clean(input.account);
      return `${kind} ${amount}: ${name}${account ? `, счёт ${account}` : ''}`;
    }

    if (action.tool === 'create_account') {
      return `создать счёт "${this.clean(input.name) || 'без названия'}"`;
    }

    if (action.tool === 'transfer_money') {
      return `перевод ${this.formatAmount(input.amount, input.currency)} со счёта ${this.clean(input.fromAccount) || '?'} на ${this.clean(input.toAccount) || '?'}`;
    }

    return TOOL_LABELS[action.tool] ?? action.tool;
  }

  private formatAmount(amount: unknown, currency: unknown) {
    const numeric = Number(amount ?? 0);
    const suffix = typeof currency === 'string' && currency.trim() ? currency.trim() : 'RUB';
    return `${Number.isFinite(numeric) ? numeric : 0} ${suffix}`;
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }
}
