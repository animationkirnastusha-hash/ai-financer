import { AIParsedCommand, AIValidatedAction } from './types';

const TOOL_LABELS: Record<string, string> = {
  create_account: 'создать счёт',
  update_account: 'изменить счёт',
  delete_account: 'удалить счёт',
  delete_accounts: 'удалить счета',
  create_transaction: 'добавить операцию',
  update_transaction: 'изменить операцию',
  transfer_money: 'перевести деньги',
  create_category: 'создать категорию',
  update_category: 'изменить категорию',
  delete_category: 'удалить категорию',
  create_section: 'создать раздел',
  update_section: 'изменить раздел',
  delete_section: 'удалить раздел',
  assign_category_to_section: 'переместить категорию',
  show_taxonomy: 'показать категории и разделы',
  show_goals: 'показать цели',
  delete_goal: 'удалить цель',
  update_goal: 'изменить цель',
  create_goal: 'создать цель',
  set_primary_account: 'сделать счёт основным',
  show_accounts: 'показать счета',
  show_transactions: 'показать операции',
  query_analytics: 'показать аналитику',
  undo_last_action: 'отменить последнее действие',
  show_companion_reactions: 'показать реакции компаньона',
  mark_companion_reactions_seen: 'прочитать реакции компаньона',
  show_premium_capabilities: 'показать возможности Premium',
  show_ai_settings: 'показать настройки ИИ',
  update_ai_settings: 'изменить настройки ИИ',
  apply_ai_settings_preset: 'применить режим настроек',
  update_onboarding_state: 'обновить обучение',
  restart_onboarding: 'запустить обучение заново',
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
    const tool = String(action.tool);

    if (tool === 'create_transaction') {
      const kind = input.kind === 'income' ? 'доход' : 'расход';
      const amount = this.formatAmount(input.amount, input.currency);
      const name = this.clean(input.description || input.category) || (input.kind === 'income' ? 'Доход' : 'Расход');
      const account = this.clean(input.account);
      return `${kind} ${amount}: ${name}${account ? `, счёт ${account}` : ''}`;
    }

    if (tool === 'update_transaction') {
      const target = this.clean(input.transaction) || this.clean(input.target) || 'операцию';
      const changes = [
        input.amount !== undefined ? `сумма ${this.formatAmount(input.amount, input.currency)}` : '',
        input.description !== undefined ? `описание: ${this.clean(input.description) || 'пусто'}` : '',
        input.account !== undefined ? `счёт: ${this.clean(input.account)}` : '',
        input.category !== undefined ? `категория: ${this.clean(input.category)}` : '',
        input.section !== undefined ? `раздел: ${this.clean(input.section)}` : '',
        input.kind !== undefined ? `тип: ${input.kind === 'income' ? 'доход' : input.kind === 'expense' ? 'расход' : 'перевод'}` : '',
      ].filter(Boolean).join(', ');
      return `изменить ${target}${changes ? ` — ${changes}` : ''}`;
    }

    if (tool === 'create_account') {
      if (input.__skipCreate) return `счёт "${this.clean(input.name) || 'без названия'}" уже существует`;
      const initialBalance = Number(input.initialBalance ?? 0);
      return `создать счёт "${this.clean(input.name) || 'без названия'}"${initialBalance > 0 ? ` с балансом ${this.formatAmount(initialBalance, input.currency)}` : ''}`;
    }

    if (tool === 'update_account') {
      const account = this.clean(input.account) || 'счёт';
      const name = this.clean(input.name);
      return name ? `переименовать счёт ${account} в ${name}` : `изменить счёт ${account}`;
    }

    if (tool === 'delete_account') {
      return `удалить счёт ${this.clean(input.account) || ''}`.trim();
    }

    if (tool === 'delete_accounts') {
      return input.scope === 'all' ? 'удалить все счета' : 'удалить выбранные счета';
    }

    if (tool === 'set_primary_account') {
      return `сделать основным счёт ${this.clean(input.account) || ''}`.trim();
    }

    if (tool === 'create_category') {
      return `создать категорию ${this.clean(input.name) || 'без названия'}${this.clean(input.section) ? ` в разделе ${this.clean(input.section)}` : ''}`;
    }

    if (tool === 'update_category') {
      return `изменить категорию ${this.clean(input.category) || ''}`.trim();
    }

    if (tool === 'delete_category') {
      return `удалить категорию ${this.clean(input.category) || ''}`.trim();
    }

    if (tool === 'create_section') {
      return `создать раздел ${this.clean(input.name) || 'без названия'}`;
    }

    if (tool === 'update_section') {
      return `переименовать раздел ${this.clean(input.section) || ''} в ${this.clean(input.name) || ''}`.trim();
    }

    if (tool === 'delete_section') {
      return `удалить раздел ${this.clean(input.section) || ''}`.trim();
    }

    if (tool === 'assign_category_to_section') {
      return `переместить категорию ${this.clean(input.category) || ''} в раздел ${this.clean(input.section) || ''}`.trim();
    }

    if (tool === 'show_taxonomy') {
      return 'показать категории и разделы';
    }

    if (tool === 'create_goal') {
      return `создать цель ${this.clean(input.title) || 'без названия'} на ${this.formatAmount(input.targetAmount, input.currency)}`;
    }

    if (tool === 'update_goal') {
      return `изменить цель ${this.clean(input.goal) || this.clean(input.title) || ''}`.trim();
    }

    if (tool === 'delete_goal') {
      return `удалить цель ${this.clean(input.goal) || ''}`.trim();
    }

    if (tool === 'show_goals') {
      return 'показать цели';
    }

    if (tool === 'transfer_money') {
      return `перевод ${this.formatAmount(input.amount, input.currency)} со счёта ${this.clean(input.fromAccount) || '?'} на ${this.clean(input.toAccount) || '?'}`;
    }

    if (tool === 'apply_ai_settings_preset') {
      return `применить режим настроек "${this.clean(input.preset) || 'balanced'}"`;
    }

    if (tool === 'update_ai_settings') {
      return 'изменить настройки ИИ';
    }

    if (tool === 'show_ai_settings') {
      return 'показать настройки ИИ';
    }

    if (tool === 'update_onboarding_state') {
      return 'обновить состояние обучения';
    }

    if (tool === 'restart_onboarding') {
      return 'запустить обучение заново';
    }

    if (tool === 'query_analytics') return 'показать аналитику';
    if (tool === 'undo_last_action') return 'отменить последнее действие';
    if (tool === 'show_companion_reactions') return 'показать реакции компаньона';
    if (tool === 'mark_companion_reactions_seen') return 'прочитать реакции компаньона';
    if (tool === 'show_premium_capabilities') return 'показать возможности Premium';

    return TOOL_LABELS[tool] ?? tool;
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
