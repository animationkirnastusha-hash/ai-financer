import { AILanguage } from './ai-language.service';
import { AIParsedCommand, AIValidatedAction } from './types';

const TOOL_LABELS_RU: Record<string, string> = {
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
  create_obligation: 'добавить обязательство',
  update_obligation: 'изменить обязательство',
  delete_obligation: 'удалить обязательство',
  mark_obligation_paid: 'отметить платёж',
  show_obligations: 'показать обязательства',
  create_obligation_reminder: 'создать напоминание',
  create_spending_limit: 'создать лимит',
  update_spending_limit: 'изменить лимит',
  delete_spending_limit: 'удалить лимит',
  show_spending_limits: 'показать лимиты',
};

const TOOL_LABELS_EN: Record<string, string> = {
  create_account: 'create account',
  update_account: 'update account',
  delete_account: 'delete account',
  delete_accounts: 'delete accounts',
  create_transaction: 'add transaction',
  update_transaction: 'update transaction',
  transfer_money: 'transfer money',
  create_category: 'create category',
  update_category: 'update category',
  delete_category: 'delete category',
  create_section: 'create section',
  update_section: 'update section',
  delete_section: 'delete section',
  assign_category_to_section: 'move category',
  show_taxonomy: 'show categories and sections',
  show_goals: 'show goals',
  delete_goal: 'delete goal',
  update_goal: 'update goal',
  create_goal: 'create goal',
  set_primary_account: 'set primary account',
  show_accounts: 'show accounts',
  show_transactions: 'show transactions',
  query_analytics: 'show analytics',
  undo_last_action: 'undo last action',
  create_obligation: 'add obligation',
  update_obligation: 'update obligation',
  delete_obligation: 'delete obligation',
  mark_obligation_paid: 'mark payment as paid',
  show_obligations: 'show obligations',
  create_obligation_reminder: 'create reminder',
  create_spending_limit: 'create spending limit',
  update_spending_limit: 'update spending limit',
  delete_spending_limit: 'delete spending limit',
  show_spending_limits: 'show spending limits',
};

export class AIPreviewService {
  buildParsed(summary: string, actions: AIValidatedAction[], language: AILanguage = 'ru'): AIParsedCommand {
    const enriched = actions.map((action) => {
      const description = this.describeAction(action, language);
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

    return {
      intent: 'batch',
      summary: this.normalizeSummary(summary, enriched, language),
      actions: enriched,
      language,
    };
  }

  buildMessage(parsed: AIParsedCommand) {
    const language = parsed.language ?? 'ru';
    if (parsed.actions.length === 0) {
      return language === 'en' ? "I didn't find an action to prepare." : 'Я не нашёл действий для выполнения.';
    }
    if (parsed.actions.length === 1) {
      return language === 'en'
        ? `Check the details: ${this.describeAction(parsed.actions[0], language)}`
        : `Проверь детали: ${this.describeAction(parsed.actions[0], language)}`;
    }

    const details = parsed.actions.map((action) => this.describeAction(action, language)).join('; ');
    return language === 'en'
      ? `Check this ${parsed.actions.length}-step package: ${details}`
      : `Проверь пакет из ${parsed.actions.length} действий: ${details}`;
  }

  buildExecutedMessage(parsed: AIParsedCommand) {
    const language = parsed.language ?? 'ru';
    if (parsed.actions.length === 1 && parsed.actions[0]?.tool === 'create_account') {
      const action = parsed.actions[0];
      const initialBalance = Number(action.input?.initialBalance ?? 0);
      const name = this.clean(action.input?.name) || (language === 'en' ? 'account' : 'счёт');
      const created = language === 'en'
        ? `Done, ${this.describeAction(action, language)}`
        : `Готово, ${this.describeAction(action, language)}`;
      if (initialBalance <= 0) {
        return language === 'en'
          ? `${created}. Add money to "${name}" now?`
          : `${created}. Добавить деньги на «${name}» сейчас?`;
      }
      return created;
    }

    if (parsed.actions.length === 1) {
      return language === 'en'
        ? `Done, ${this.describeAction(parsed.actions[0], language)}.`
        : `Готово, ${this.describeAction(parsed.actions[0], language)}.`;
    }

    const details = parsed.actions.map((action) => this.describeAction(action, language)).join('; ');
    return language === 'en' ? `Done. Package completed: ${details}` : `Готово. Пакет выполнен: ${details}`;
  }

  private normalizeSummary(summary: string, actions: AIValidatedAction[], language: AILanguage) {
    const clean = this.clean(summary);
    if (!clean || /^проверь действие/i.test(clean) || /^проверь \d+/i.test(clean)) {
      if (actions.length === 1) return this.describeAction(actions[0], language);
      return actions.map((action) => this.describeAction(action, language)).join('; ');
    }

    if (language === 'en' && /[А-Яа-яЁё]/.test(clean)) {
      if (actions.length === 1) return this.describeAction(actions[0], language);
      return actions.map((action) => this.describeAction(action, language)).join('; ');
    }

    return clean;
  }

  private describeAccountType(type: unknown, language: AILanguage) {
    const clean = this.clean(type).toLowerCase();
    if (language === 'en') {
      if (clean === 'card') return 'card account';
      if (clean === 'cash') return 'cash account';
      if (clean === 'savings') return 'savings account';
      if (clean === 'investment') return 'investment account';
      if (clean === 'credit') return 'credit account';
      return 'account';
    }

    if (clean === 'card') return 'карту';
    if (clean === 'cash') return 'наличные';
    if (clean === 'savings') return 'накопительный счёт';
    if (clean === 'investment') return 'инвестиционный счёт';
    if (clean === 'credit') return 'кредитный счёт';
    return 'счёт';
  }

  private describeAction(action: AIValidatedAction, language: AILanguage) {
    const input = action.input ?? {};
    const tool = String(action.tool);

    if (tool === 'create_transaction') return this.describeTransaction(input, language);
    if (tool === 'update_transaction') return this.describeTransactionUpdate(input, language);
    if (tool === 'create_account') return this.describeCreateAccount(input, language);
    if (tool === 'update_account') return this.describeUpdateAccount(input, language);
    if (tool === 'delete_account') return language === 'en' ? `delete account ${this.clean(input.account) || ''}`.trim() : `удалить счёт ${this.clean(input.account) || ''}`.trim();
    if (tool === 'delete_accounts') return language === 'en' ? (input.scope === 'all' ? 'delete all accounts' : 'delete selected accounts') : (input.scope === 'all' ? 'удалить все счета' : 'удалить выбранные счета');
    if (tool === 'set_primary_account') return language === 'en' ? `set primary account ${this.clean(input.account) || ''}`.trim() : `сделать основным счёт ${this.clean(input.account) || ''}`.trim();
    if (tool === 'create_category') return language === 'en' ? `create category ${this.clean(input.name) || 'untitled'}${this.clean(input.section) ? ` in section ${this.clean(input.section)}` : ''}` : `создать категорию ${this.clean(input.name) || 'без названия'}${this.clean(input.section) ? ` в разделе ${this.clean(input.section)}` : ''}`;
    if (tool === 'update_category') return language === 'en' ? `update category ${this.clean(input.category) || ''}`.trim() : `изменить категорию ${this.clean(input.category) || ''}`.trim();
    if (tool === 'delete_category') return language === 'en' ? `delete category ${this.clean(input.category) || ''}`.trim() : `удалить категорию ${this.clean(input.category) || ''}`.trim();
    if (tool === 'create_section') return language === 'en' ? `create section ${this.clean(input.name) || 'untitled'}` : `создать раздел ${this.clean(input.name) || 'без названия'}`;
    if (tool === 'update_section') return language === 'en' ? `rename section ${this.clean(input.section) || ''} to ${this.clean(input.name) || ''}`.trim() : `переименовать раздел ${this.clean(input.section) || ''} в ${this.clean(input.name) || ''}`.trim();
    if (tool === 'delete_section') return language === 'en' ? `delete section ${this.clean(input.section) || ''}`.trim() : `удалить раздел ${this.clean(input.section) || ''}`.trim();
    if (tool === 'assign_category_to_section') return language === 'en' ? `move category ${this.clean(input.category) || ''} to section ${this.clean(input.section) || ''}`.trim() : `переместить категорию ${this.clean(input.category) || ''} в раздел ${this.clean(input.section) || ''}`.trim();
    if (tool === 'show_taxonomy') return language === 'en' ? 'show categories and sections' : 'показать категории и разделы';
    if (tool === 'create_goal') return language === 'en' ? `create goal ${this.clean(input.title) || 'untitled'} for ${this.formatAmount(input.targetAmount, input.currency)}` : `создать цель ${this.clean(input.title) || 'без названия'} на ${this.formatAmount(input.targetAmount, input.currency)}`;
    if (tool === 'update_goal') return language === 'en' ? `update goal ${this.clean(input.goal) || this.clean(input.title) || ''}`.trim() : `изменить цель ${this.clean(input.goal) || this.clean(input.title) || ''}`.trim();
    if (tool === 'delete_goal') return language === 'en' ? `delete goal ${this.clean(input.goal) || ''}`.trim() : `удалить цель ${this.clean(input.goal) || ''}`.trim();
    if (tool === 'show_goals') return language === 'en' ? 'show goals' : 'показать цели';
    if (tool === 'transfer_money') return language === 'en' ? `transfer ${this.formatAmount(input.amount, input.currency)} from ${this.clean(input.fromAccount) || '?'} to ${this.clean(input.toAccount) || '?'}` : `перевод ${this.formatAmount(input.amount, input.currency)} со счёта ${this.clean(input.fromAccount) || '?'} на ${this.clean(input.toAccount) || '?'}`;
    if (tool === 'create_spending_limit') return language === 'en' ? `create ${this.describeLimitTarget(input, language)} for ${this.formatAmount(input.amount, input.currency)}${this.describeLimitPeriod(input.period, language)}` : `создать ${this.describeLimitTarget(input, language)} на ${this.formatAmount(input.amount, input.currency)}${this.describeLimitPeriod(input.period, language)}`;
    if (tool === 'update_spending_limit') return language === 'en' ? `update ${this.clean(input.limit) || this.describeLimitTarget(input, language)}${input.amount !== undefined ? ` to ${this.formatAmount(input.amount, input.currency)}` : ''}`.trim() : `изменить ${this.clean(input.limit) || this.describeLimitTarget(input, language)}${input.amount !== undefined ? ` на ${this.formatAmount(input.amount, input.currency)}` : ''}`.trim();
    if (tool === 'delete_spending_limit') return language === 'en' ? `delete ${this.clean(input.limit) || this.describeLimitTarget(input, language)}`.trim() : `удалить ${this.clean(input.limit) || this.describeLimitTarget(input, language)}`.trim();
    if (tool === 'show_spending_limits') return language === 'en' ? 'show spending limits' : 'показать лимиты';
    if (tool === 'create_obligation') return language === 'en' ? `add obligation ${this.clean(input.title) || 'untitled'}${Number(input.monthlyPayment ?? 0) > 0 ? `, payment ${this.formatAmount(input.monthlyPayment, input.currency)}` : ''}` : `добавить обязательство ${this.clean(input.title) || 'без названия'}${Number(input.monthlyPayment ?? 0) > 0 ? `, платёж ${this.formatAmount(input.monthlyPayment, input.currency)}` : ''}`;
    if (tool === 'update_obligation') return language === 'en' ? `update obligation ${this.clean(input.obligation) || this.clean(input.title) || ''}`.trim() : `изменить обязательство ${this.clean(input.obligation) || this.clean(input.title) || ''}`.trim();
    if (tool === 'delete_obligation') return language === 'en' ? `delete obligation ${this.clean(input.obligation) || ''}`.trim() : `удалить обязательство ${this.clean(input.obligation) || ''}`.trim();
    if (tool === 'mark_obligation_paid') return language === 'en' ? `mark obligation payment ${this.clean(input.obligation) || ''} as paid${input.amount !== undefined ? ` for ${this.formatAmount(input.amount, input.currency)}` : ''}`.trim() : `отметить платёж по обязательству ${this.clean(input.obligation) || ''}${input.amount !== undefined ? ` на ${this.formatAmount(input.amount, input.currency)}` : ''}`.trim();
    if (tool === 'show_obligations') return language === 'en' ? 'show obligations and reminders' : 'показать обязательства и напоминания';
    if (tool === 'create_obligation_reminder') return language === 'en' ? `create reminder ${this.clean(input.title) || ''}`.trim() : `создать напоминание ${this.clean(input.title) || ''}`.trim();
    if (tool === 'query_analytics') return language === 'en' ? 'show analytics' : 'показать аналитику';
    if (tool === 'undo_last_action') return language === 'en' ? 'undo last action' : 'отменить последнее действие';

    const labels = language === 'en' ? TOOL_LABELS_EN : TOOL_LABELS_RU;
    return labels[tool] ?? tool;
  }

  private describeTransaction(input: Record<string, unknown>, language: AILanguage) {
    const kind = input.kind === 'income'
      ? (language === 'en' ? 'income' : 'доход')
      : (language === 'en' ? 'expense' : 'расход');
    const name = this.clean(input.description || input.category || input.title) || (input.kind === 'income' ? (language === 'en' ? 'Income' : 'Доход') : (language === 'en' ? 'Expense' : 'Расход'));
    const account = this.clean(input.account);
    return language === 'en'
      ? `${kind} ${this.formatAmount(input.amount, input.currency)}: ${name}${account ? `, account ${account}` : ''}`
      : `${kind} ${this.formatAmount(input.amount, input.currency)}: ${name}${account ? `, счёт ${account}` : ''}`;
  }

  private describeTransactionUpdate(input: Record<string, unknown>, language: AILanguage) {
    const target = this.clean(input.transaction) || this.clean(input.target) || (language === 'en' ? 'transaction' : 'операцию');
    const changes = [
      input.amount !== undefined ? (language === 'en' ? `amount ${this.formatAmount(input.amount, input.currency)}` : `сумма ${this.formatAmount(input.amount, input.currency)}`) : '',
      input.description !== undefined ? (language === 'en' ? `description: ${this.clean(input.description) || 'empty'}` : `описание: ${this.clean(input.description) || 'пусто'}`) : '',
      input.account !== undefined ? (language === 'en' ? `account: ${this.clean(input.account)}` : `счёт: ${this.clean(input.account)}`) : '',
      input.category !== undefined ? (language === 'en' ? `category: ${this.clean(input.category)}` : `категория: ${this.clean(input.category)}`) : '',
      input.section !== undefined ? (language === 'en' ? `section: ${this.clean(input.section)}` : `раздел: ${this.clean(input.section)}`) : '',
      input.kind !== undefined ? (language === 'en' ? `type: ${this.clean(input.kind)}` : `тип: ${input.kind === 'income' ? 'доход' : input.kind === 'expense' ? 'расход' : 'перевод'}`) : '',
    ].filter(Boolean).join(', ');
    return language === 'en' ? `update ${target}${changes ? ` — ${changes}` : ''}` : `изменить ${target}${changes ? ` — ${changes}` : ''}`;
  }

  private describeCreateAccount(input: Record<string, unknown>, language: AILanguage) {
    const name = this.clean(input.name) || (language === 'en' ? 'untitled' : 'без названия');
    if (input.__skipCreate) return language === 'en' ? `account "${name}" already exists` : `счёт "${name}" уже существует`;
    const initialBalance = Number(input.initialBalance ?? 0);
    const typeLabel = this.describeAccountType(input.type, language);
    return language === 'en'
      ? `create ${typeLabel} "${name}"${initialBalance > 0 ? ` with balance ${this.formatAmount(initialBalance, input.currency)}` : ''}`
      : `создать ${typeLabel} "${name}"${initialBalance > 0 ? ` с балансом ${this.formatAmount(initialBalance, input.currency)}` : ''}`;
  }

  private describeUpdateAccount(input: Record<string, unknown>, language: AILanguage) {
    const account = this.clean(input.account) || (language === 'en' ? 'account' : 'счёт');
    const name = this.clean(input.name);
    if (language === 'en') return name ? `rename account ${account} to ${name}` : `update account ${account}`;
    return name ? `переименовать счёт ${account} в ${name}` : `изменить счёт ${account}`;
  }

  private describeLimitTarget(input: Record<string, unknown>, language: AILanguage) {
    if (input.targetType === 'account') return language === 'en' ? `account limit ${this.clean(input.account) || ''}`.trim() : `лимит по счёту ${this.clean(input.account) || ''}`.trim();
    if (input.targetType === 'category') return language === 'en' ? `category limit ${this.clean(input.category) || ''}`.trim() : `лимит по категории ${this.clean(input.category) || ''}`.trim();
    return language === 'en' ? 'total spending limit' : 'общий лимит расходов';
  }

  private describeLimitPeriod(period: unknown, language: AILanguage) {
    const value = this.clean(period);
    if (value === 'daily') return language === 'en' ? ' per day' : ' в день';
    if (value === 'weekly') return language === 'en' ? ' per week' : ' в неделю';
    return language === 'en' ? ' per month' : ' в месяц';
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
