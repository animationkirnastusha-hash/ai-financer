import { AIPlan, AIToolCall, AIToolName } from './types';
import { createAIProvider } from './providers/ai-provider.factory';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string; sectionId?: string | null }>;
  sections?: Array<{ id?: string; name?: string }>;
  goals?: Array<{ title?: string; targetAmount?: number; currentAmount?: number; currency?: string; status?: string }>;
  recentTransactions?: Array<{ description?: string | null; type?: string; amount?: number; account?: { name?: string }; category?: { name?: string } | null; section?: { name?: string } | null }>;
  memory?: {
    accountAliases?: Array<{ name?: string; type?: string; currency?: string; aliases?: string[] }>;
    preferences?: unknown[];
    recentSuccessfulCommands?: Array<{ command?: string; intent?: string; status?: string }>;
  };
  aiSettings?: {
    preset?: string;
    defaultExpenseAccountId?: string | null;
    defaultIncomeAccountId?: string | null;
    autoConfirmExpenseLimit?: number;
    autoConfirmIncomeLimit?: number;
    autoConfirmTransferLimit?: number;
    companionTone?: string;
  } | null;
  aiSessionState?: { pendingIntent?: string | null; pendingTool?: string | null; lastCommand?: string | null; lastResult?: unknown } | null;
  onboardingState?: {
    status?: string;
    currentStep?: string | null;
    skipped?: boolean;
  } | null;
};

export class AIPlannerService {
  private readonly provider = createAIProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const compactContext = this.compactContext(context);
    let raw: Record<string, unknown>;
    let usedFallback = false;

    try {
      raw = await this.provider.generateJson<Record<string, unknown>>({
        system: this.systemPrompt(),
        prompt: this.buildPrompt(command, compactContext),
        temperature: 0,
        modelRole: 'fast',
        timeoutMs: 12_000,
        numPredict: 520,
      });
    } catch (error) {
      usedFallback = true;
      console.warn('[AI] planner primary failed, retrying focused planner', {
        message: error instanceof Error ? error.message : String(error),
      });
      raw = await this.runFocusedPlanner(command, compactContext);
    }

    let plan = this.normalizePlan(raw, command);

    if (!plan.actions.length && this.looksLikeOperationalCommand(command)) {
      usedFallback = true;
      console.warn('[AI] planner returned no actions for operational command, retrying focused planner');
      raw = await this.runFocusedPlanner(command, compactContext);
      plan = this.normalizePlan(raw, command);
    }

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.actions.map((action) => action.tool),
      usedFallback,
    });

    return plan;
  }

  private systemPrompt() {
    return [
      'Return ONLY strict JSON.',
      'Format for actions: {"mode":"actions","actions":[{"tool":"create_transaction","input":{}}],"summary":"..."}.',
      'For non-financial or philosophical small talk, return {"mode":"reply","summary":"short human answer, then gently return to finance context","actions":[]}.',
      'No prose. No markdown. No questions outside JSON.',
      'Never output accountId/categoryId/sectionId; backend resolves entities.',
      'The current USER message is the primary source of truth. Context and memory are secondary only for pronouns or explicit continuations.',
      'If USER gives an exact name in quotes or after words like с названием/name, copy it exactly. Do not replace it with any memory value or older command.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'RULES:',
      'Use only listed tools.',
      'If the user says something unrelated to finance, answer briefly and meaningfully in summary, but do not create actions and do not pretend to save memory.',
      'For philosophical/off-topic questions: respond in 1-2 short lines, connect gently to financial stability/control only if natural.',
      'For analytics questions like сколько потратил/доход/топ категорий/баланс, use query_analytics.',
      'For undo/cancel last operation, use undo_last_action.',
      'For companion/reactions, use show_companion_reactions.',
      'For premium/tariff/capabilities, use show_premium_capabilities.',
      'Money commands must become create_transaction.',
      'Income/deposit/top-up/salary/put money onto account => create_transaction kind income.',
      'Expense/payment/purchase/item+amount => create_transaction kind expense.',
      'For every transaction, infer human category and section from meaning; do not leave category/section empty when meaning is clear.',
      'Category/section management must use taxonomy tools: create_category, update_category, delete_category, create_section, update_section, delete_section, assign_category_to_section, show_taxonomy.',
      'Create account only creates account with initialBalance 0.',
      'Create account and put/add money => create_account initialBalance 0 + create_transaction income to that exact new account name.',
      'For create_account + create_transaction in one plan, create_account.input.name and create_transaction.input.account must be exactly the same new account name from USER.',
      'Rename/change existing account => update_account, not create_account.',
      'Make account main/default/primary => set_primary_account. If user does not specify income/expense, scope both.',
      'Delete all accounts => delete_accounts scope all. Delete one account => delete_account.',
      'Create/update/delete/show financial goals => create_goal/update_goal/delete_goal/show_goals.',
      'Show categories/sections/list of spending structure => show_taxonomy.',
      'If user command refers to previous command/result with words like it/this/that/его/этот/тот/там, use CTX.aiSessionState.lastCommand and CTX.aiSessionState.lastResult to resolve context.',
      'If essential entity remains ambiguous after context, choose the safest action that asks clarification by leaving missing account/goal/category/section name rather than inventing.',
      'Preserve spoken amounts exactly as user wrote them.',
      'Use account names/aliases from CTX when present.',
      'If user asks to show/change AI settings, use show_ai_settings/update_ai_settings/apply_ai_settings_preset.',
      'If user asks to start/skip/finish tutorial/onboarding, use restart_onboarding/update_onboarding_state.',
      'If user asks for режим строгий/баланс/простой, use apply_ai_settings_preset.',
      'If user asks to show goals/цели, use show_goals.',
      'If user sets default account, use set_primary_account with natural account name.',
      'For expense without account, leave account null; backend may use default account or ask clarification.',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('');
  }

  private async runFocusedPlanner(command: string, context: unknown): Promise<Record<string, unknown>> {
    const focusedContext = this.focusContext(context);

    return this.provider.generateJson<Record<string, unknown>>({
      system: [
        'Return ONLY strict JSON. No markdown. No prose.',
        'Use only tool calls from the provided contract.',
        'The current USER message is absolute source of truth.',
        'Do not reuse names from context, memory, or previous commands when USER gives a new exact name.',
        'If USER says create account and put/add money there, return exactly two actions: create_account and create_transaction income.',
      ].join(' '),
      prompt: [
        'TOOLS:',
        getPlannerToolContract(),
        'OUTPUT EXAMPLES:',
        '{"mode":"actions","summary":"Создать счёт и пополнить.","actions":[{"tool":"create_account","input":{"name":"Наличка","type":"cash","currency":"RUB"}},{"tool":"create_transaction","input":{"kind":"income","amount":1000,"currency":"RUB","account":"Наличка","description":"Пополнение счёта","category":"Пополнение","section":"Доходы"}}]}',
        '{"mode":"reply","summary":"Короткий ответ по смыслу без финансового действия.","actions":[]}',
        'RULES:',
        'Exact quoted names must be copied exactly.',
        'Name after “с названием” must be copied exactly.',
        'For account creation, do not invent another account name.',
        'For income/top-up after account creation, create_transaction.input.account must equal create_account.input.name.',
        'For expense/income/transfer, use create_transaction/transfer_money.',
        'For goals, use create_goal/update_goal/delete_goal/show_goals.',
        'For categories/sections, use taxonomy tools.',
        'For off-topic, return reply with empty actions.',
        'CONTEXT:', JSON.stringify(focusedContext),
        'USER:', command,
      ].join('\n'),
      temperature: 0,
      modelRole: 'base',
      timeoutMs: 18_000,
      numPredict: 600,
    });
  }

  private focusContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts) ? value.accounts.slice(0, 8).map((item) => item.name).filter(Boolean) : [],
      categories: Array.isArray(value.categories) ? value.categories.slice(0, 12).map((item) => item.name).filter(Boolean) : [],
      sections: Array.isArray(value.sections) ? value.sections.slice(0, 12).map((item) => item.name).filter(Boolean) : [],
      goals: Array.isArray(value.goals) ? value.goals.slice(0, 8).map((item) => item.title).filter(Boolean) : [],
    };
  }

  private looksLikeOperationalCommand(command: string) {
    const lower = command.toLowerCase();
    const markers = [
      'создай', 'добавь', 'запиши', 'положи', 'пополн', 'доход', 'расход', 'переведи', 'сделай', 'переимен', 'измени', 'удали', 'цель', 'счёт', 'счет', 'категор', 'раздел',
      'create', 'add', 'income', 'expense', 'transfer', 'rename', 'delete', 'goal', 'account', 'category', 'section',
    ];
    return markers.some((marker) => lower.includes(marker));
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    const memory = value.memory && typeof value.memory === 'object' ? value.memory : {};

    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 8).map((account) => account.name).filter(Boolean)
        : [],
      accountAliases: Array.isArray(memory.accountAliases)
        ? memory.accountAliases.slice(0, 8).map((item) => ({
          name: item.name,
          aliases: Array.isArray(item.aliases) ? item.aliases.slice(0, 5) : [],
        }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 12).map((category) => category.name).filter(Boolean)
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 12).map((section) => section.name).filter(Boolean)
        : [],
      preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(0, 6) : [],
      recentSuccessfulCommands: Array.isArray(memory.recentSuccessfulCommands)
        ? memory.recentSuccessfulCommands.slice(0, 5)
        : [],
      aiSettings: value.aiSettings
        ? {
          preset: value.aiSettings.preset,
          defaultExpenseAccountId: value.aiSettings.defaultExpenseAccountId,
          defaultIncomeAccountId: value.aiSettings.defaultIncomeAccountId,
          autoConfirmExpenseLimit: value.aiSettings.autoConfirmExpenseLimit,
          autoConfirmIncomeLimit: value.aiSettings.autoConfirmIncomeLimit,
          autoConfirmTransferLimit: value.aiSettings.autoConfirmTransferLimit,
          companionTone: value.aiSettings.companionTone,
        }
        : null,
      onboardingState: value.onboardingState
        ? {
          status: value.onboardingState.status,
          currentStep: value.onboardingState.currentStep,
          skipped: value.onboardingState.skipped,
        }
        : null,
      goals: Array.isArray(value.goals)
        ? value.goals.slice(0, 8).map((goal) => ({
          title: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          currency: goal.currency,
          status: goal.status,
        }))
        : [],
      recentTransactions: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.slice(0, 6).map((item) => ({
          type: item.type,
          amount: item.amount,
          description: item.description,
          account: item.account?.name,
          category: item.category?.name,
          section: item.section?.name,
        }))
        : [],
      aiSessionState: value.aiSessionState
        ? {
          pendingIntent: value.aiSessionState.pendingIntent,
          pendingTool: value.aiSessionState.pendingTool,
          lastCommand: value.aiSessionState.lastCommand,
          lastResult: value.aiSessionState.lastResult,
        }
        : null,
    };
  }

  private normalizePlan(raw: Record<string, unknown>, command: string): AIPlan {
    const rawActions = Array.isArray(raw.actions)
      ? raw.actions
      : Array.isArray(raw.toolCalls)
        ? raw.toolCalls
        : [];

    const actions: AIToolCall[] = rawActions
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item): AIToolCall | null => this.normalizeAction(item, command))
      .filter((action): action is AIToolCall => action !== null);

    this.applyCurrentCommandEntityGuards(actions, command);

    return {
      mode: 'actions',
      language: this.asOptionalString(raw.language),
      summary: this.asOptionalString(raw.summary) ?? (actions.length ? 'Действие подготовлено.' : 'Я рядом. Могу ответить коротко и помочь с финансами.'),
      actions,
    };
  }


  private applyCurrentCommandEntityGuards(actions: AIToolCall[], command: string) {
    const explicitAccountName = this.extractExplicitNewAccountName(command);
    if (!explicitAccountName) return;

    const createAccount = actions.find((action) => action.tool === 'create_account');
    if (!createAccount) return;

    createAccount.input.name = explicitAccountName;

    for (const action of actions) {
      if (action.tool !== 'create_transaction') continue;
      const kind = this.asOptionalString(action.input.kind)?.toLowerCase();
      if (kind && kind !== 'income') continue;

      const currentAccount = this.asOptionalString(action.input.account);
      const lowerCommand = command.toLowerCase();
      const looksLikeOldMemory = Boolean(currentAccount && !lowerCommand.includes(currentAccount.toLowerCase()));
      if (!currentAccount || looksLikeOldMemory) {
        action.input.account = explicitAccountName;
      }
    }
  }

  private extractExplicitNewAccountName(command: string) {
    const clean = command.trim().replace(/\s+/g, ' ');
    if (!clean) return null;

    const quoted = clean.match(/(?:сч[её]т|счет|кошел[её]к|кар(?:т[ау]|та)|account|wallet|card)[^"«»]{0,100}["«]([^"»]{2,100})["»]/iu)
      ?? clean.match(/(?:названи(?:ем|е)|name)\s*["«]([^"»]{2,100})["»]/iu);
    if (quoted?.[1]) return this.cleanEntityName(quoted[1]);

    const named = clean.match(/(?:с\s+названи(?:ем|е)|назови(?:\s+его)?|name(?:d)?)\s+(.+?)(?=\s+(?:и\s+)?(?:с\s+балансом|балансом|положи|пополн|закинь|туда|на\s+\d|сумм(?:ой|а)|руб(?:\.|лей|ля|ль)?|₽|usd|eur|vnd)|$)/iu);
    if (named?.[1]) return this.cleanEntityName(named[1]);

    return null;
  }

  private cleanEntityName(value: unknown) {
    return typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').replace(/^["'«»]+|["'«»]+$/g, '').trim()
      : '';
  }

  private normalizeAction(item: Record<string, unknown>, command: string): AIToolCall | null {
    const rawTool = typeof item.tool === 'string' ? item.tool : typeof item.name === 'string' ? item.name : '';
    const input = this.asRecord(item.input ?? item.params ?? item.args ?? item.arguments);

    const alias = this.normalizeToolAlias(rawTool);
    if (!alias) return null;

    const nextInput = { ...input, ...alias.extraInput };
    nextInput.__userText = command;

    const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined;
    return reason ? { tool: alias.tool, input: nextInput, reason } : { tool: alias.tool, input: nextInput };
  }

  private normalizeToolAlias(rawTool: string): { tool: AIToolName; extraInput: Record<string, unknown> } | null {
    const clean = rawTool.trim();

    if (this.isToolName(clean)) {
      return { tool: clean, extraInput: {} };
    }

    const lower = clean.toLowerCase();

    if (lower === 'create_expense' || lower === 'add_expense' || lower === 'expense') {
      return { tool: 'create_transaction', extraInput: { kind: 'expense' } };
    }

    if (lower === 'create_income' || lower === 'add_income' || lower === 'income' || lower === 'deposit' || lower === 'top_up') {
      return { tool: 'create_transaction', extraInput: { kind: 'income' } };
    }

    if (lower === 'transfer_between_accounts' || lower === 'transfer') {
      return { tool: 'transfer_money', extraInput: {} };
    }

    return null;
  }

  private isToolName(value: string): value is AIToolName {
    return TOOL_NAMES.has(value as AIToolName);
  }

  private asOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
