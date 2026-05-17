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
    const enriched = actions.map((action) => {
      const description = this.describeAction(action);
      return {
        ...action,
        reason: description,
        title: description,
        description,
        input: {
          ...action.input,
          previewTitle: description,
          previewDescription: description,
        },
      };
    });

    return { intent: 'batch', summary: this.normalizeSummary(summary, enriched), actions: enriched };
  }

  buildMessage(parsed: AIParsedCommand) {
    if (parsed.actions.length === 0) return 'Я не нашёл действий для выполнения.';
    if (parsed.actions.length === 1) return `Проверь: ${this.describeAction(parsed.actions[0])}`;
    return `Проверь пакет из ${parsed.actions.length} действий: ${parsed.actions.map((action) => this.describeAction(action)).join('; ')}`;
  }

  buildExecutedMessage(parsed: AIParsedCommand) {
    if (parsed.actions.length === 1) return `Готово: ${this.describeAction(parsed.actions[0])}`;
    return `Готово. Пакет выполнен: ${parsed.actions.map((action) => this.describeAction(action)).join('; ')}`;
  }

  private normalizeSummary(summary: string, actions: AIValidatedAction[]) {
    const clean = this.clean(summary);
    if (!clean || /^проверь действие/i.test(clean) || /^проверь \d+/i.test(clean)) {
      if (actions.length === 1) return this.describeAction(actions[0]);
      return actions.map((action) => this.describeAction(action)).join('; ');
    }

    return clean;
  }

  private describeAction(action: AIValidatedAction) {
    const input = action.input ?? {};

    if (action.tool === 'create_transaction') {
      const kind = input.kind === 'income' ? 'доход' : 'расход';
      const amount = this.formatAmount(input.amount, input.currency);
      const name = this.clean(input.description || input.category) || (input.kind === 'income' ? 'Доход' : 'Расход');
      const account = this.clean(input.account);
      return `${kind} ${amount}: ${name}${account ? `, счёт ${account}` : ''}`;
    }

    if (action.tool === 'create_account') {
      if (input.__skipCreate) return `счёт "${this.clean(input.name) || 'без названия'}" уже существует`;
      const initialBalance = Number(input.initialBalance ?? 0);
      return `создать счёт "${this.clean(input.name) || 'без названия'}"${initialBalance > 0 ? ` с балансом ${this.formatAmount(initialBalance, input.currency)}` : ''}`;
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
