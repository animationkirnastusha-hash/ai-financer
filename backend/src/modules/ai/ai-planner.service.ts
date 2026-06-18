import { AIPlan, AIToolCall, AIToolName } from './types';
import { aiLanguageService } from './ai-language.service';
import { createAIProvider } from './providers/ai-provider.factory';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string; sectionId?: string | null }>;
  sections?: Array<{ id?: string; name?: string }>;
  goals?: Array<{ title?: string; targetAmount?: number; currentAmount?: number; currency?: string; status?: string }>;
  obligations?: Array<{ title?: string; type?: string; monthlyPayment?: number; currentDebt?: number; currency?: string; status?: string; nextPaymentDate?: string | Date | null }>;
  obligationReminders?: Array<{ title?: string; dueDate?: string | Date; remindAt?: string | Date; status?: string }>;
  recentTransactions?: Array<{ id?: string; description?: string | null; type?: string; amount?: number; createdAt?: string; account?: { name?: string }; category?: { name?: string } | null; section?: { name?: string } | null }>;
  memory?: {
    accountAliases?: Array<{ name?: string; type?: string; currency?: string; aliases?: string[] }>;
    categoryAliases?: Array<{ name?: string; aliases?: string[] }>;
    sectionAliases?: Array<{ name?: string; aliases?: string[] }>;
    goalAliases?: Array<{ name?: string; aliases?: string[] }>;
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
        timeoutMs: 15_000,
        numPredict: 760,
      });
    } catch (error) {
      usedFallback = true;
      console.warn('[AI] planner primary failed, retrying focused planner', {
        message: error instanceof Error ? error.message : String(error),
      });
      raw = await this.runFocusedPlanner(command, compactContext);
    }

    let plan = this.normalizePlan(raw, command);

    if (!plan.actions.length) {
      usedFallback = true;
      console.warn('[AI] planner returned no actions, retrying focused planner once');
      raw = await this.runFocusedPlanner(command, compactContext);
      plan = this.normalizePlan(raw, command);
    }

    if (!plan.actions.length) {
      usedFallback = true;
      console.warn('[AI] planner still returned no actions, retrying tool recovery planner');
      raw = await this.runToolRecoveryPlanner(command, compactContext);
      plan = this.normalizePlan(raw, command);
    }

    if (plan.actions.length) {
      const reviewedPlan = await this.reviewPlanAgainstContract(command, compactContext, plan);
      if (reviewedPlan?.actions.length) {
        plan = reviewedPlan;
      }
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
      'Return ONLY strict JSON. No prose, no markdown, no comments.',
      'Action format: {"mode":"actions","actions":[{"tool":"create_transaction","input":{}}],"summary":"short result text"}.',
      'Reply format for non-action questions: {"mode":"reply","summary":"short human answer","actions":[]}.',
      'Use semantic understanding and the tool contract. Do not emulate old parsers, regex extraction, keyword shortcuts, or rule tables.',
      'The current USER message is the primary source of truth. Context helps only with existing entities, pronouns, continuations, defaults, and recent operations.',
      'Never output accountId, categoryId, sectionId, goalId, transactionId, or raw database identifiers. Output natural entity names only; validator resolves them.',
      'Treat voice text as noisy natural speech: missing punctuation, informal words, pauses and compact numbers are normal. Preserve the intended amount and entity if it is clear.',
      'Amounts must be positive plain numbers. Compact spoken amount forms with thousand meaning must be expanded to the full number. If the amount is uncertain, leave amount missing for validator clarification.',
      'Separate financial dimensions: tool/action, amount, currency, source account, destination account, transaction title, financial category, section, merchant/place, purchased items, tags, description.',
      'For transactions, category and section describe what the money is for. Merchant/place describes where it happened. A shop, gas station, marketplace, bank, person or place is not automatically a category or section.',
      'Preserve broad user-provided account and taxonomy references. Do not replace a general user account reference with a specific saved account name from context unless the user clearly named that saved account.',
      'Preserve broad user-provided category references. Do not narrow a broad category into a more specific saved category from context unless the user clearly chose that specific category.',
      'For mixed purchases with one total amount and no item-level prices, create exactly one transaction. Put every named purchased object/service into items as a string array, keep merchant/place separately, and choose a broad honest category/section only when semantically clear.',
      'When a transaction mentions concrete goods, services, or purchase components, preserve them in items even if prices for the individual items are not provided. Do not drop them into the title only.',
      'Transaction title must be short and clean. Do not copy the full spoken command, do not put amount/account into title, and do not use “merchant: items” as title. Use merchant/place/items fields for those details.',
      'If the user describes an existing operation correction, use update_transaction. Do not create a new transaction for corrections.',
      'Savings goals are not expenses or income. Goal target amount belongs to create_goal.targetAmount.',
      'Loans, mortgages, installments, subscriptions and recurring obligations are obligations, not normal one-time transactions unless the user says they paid one payment.',
      'Requests to show nearest/upcoming payments, loans, credits, subscriptions or required payments must use show_obligations. Requests to mark a loan/subscription payment paid must use mark_obligation_paid. Requests to change a loan/subscription payment must use update_obligation.',
      'Requests to set, show, change or delete spending limits/budget limits must use create_spending_limit, show_spending_limits, update_spending_limit or delete_spending_limit. Limits are app data, not coaching text.',
      'If essential data is missing, leave the field missing/null. Validator will ask a short clarification. Do not invent accounts, amounts, categories, dates, or prices.',
      'If USER contains VOICE_SESSION_COMMAND, merge segments into one coherent final intent. Later correction segments override conflicting earlier details and non-conflicting details remain.',
      'For screen-opening/navigation requests, do not invent financial actions. Reply naturally; UI navigation may handle screens separately.',
      'Do not include reasoning. Do not explain the plan. Do not include examples in the JSON output.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'PLANNING_GUIDE:',
      'Use only listed tools and fields from the contract.',
      'Do not implement phrase-specific financial behavior. Decide by semantic meaning of the full request.',
      'Output null or omit fields that are not known. Do not invent missing data to avoid clarification.',
      'Use CTX entity names when the user clearly refers to an existing account, category, section, goal, loan or transaction. Different endings and colloquial forms may refer to the same entity.',
      'Financial mutations must use the matching tool family: transactions, transfers, accounts, goals, obligations, taxonomy, settings, onboarding, analytics.',
      'For create_transaction: kind is income or expense; amount is one positive number; account is natural account name; title is a short label; category/section are financial meaning; merchant/place/items/tags/description carry context. items must be an array when named goods/services are present.',
      'For income, category/section should describe income source or broad income group, not the account receiving money.',
      'For expense, category/section should describe purpose. If purpose has several unrelated items under one total, do not split the total; use one transaction with structured items/tags and a broad category/section. If no purpose category is confident, leave category/section empty instead of using generic Expense/Расход.',
      'If a broad category is clear, keep it broad and place concrete purchase details in items/tags/description. Do not pick a narrower category just because it exists in context.',
      'Merchant/place must not replace category/section unless the user explicitly manages taxonomy and asks to create or rename that category/section.',
      'If no existing category/section fits and the meaning is still clear, output a concise natural category/section name; backend may create it. If meaning is unclear, leave category/section empty.',
      'Do not turn a store, location or brand into transaction title when items/purpose are present. Keep title independent from merchant.',
      'For account setup plus first operation, return the account action first and the requested financial action second where safe.',
      'When the user says they have money in a new place/account, treat it as account setup with initialBalance/top-up, not as an expense.',
      'For transfers, use transfer_money and both account names. Do not create expense/income pairs for transfers.',
      'For analytics/show/list requests, use query_analytics or show_* tools; do not create or update data. If the user asks for balance of a specific account, use query_analytics with metric accounts or show_accounts. If the user asks for expenses by a specific place, category, merchant or item, put that natural search phrase into query_analytics.filter/search/category instead of returning an unfiltered total.',
      'For obligations and limits: nearest payments -> show_obligations; add credit/subscription -> create_obligation; mark paid -> mark_obligation_paid; edit payment -> update_obligation; set limit -> create_spending_limit; show limits -> show_spending_limits; edit limit -> update_spending_limit; delete limit -> delete_spending_limit.',
      'For undo/cancel last completed operation, use undo_last_action. For cancelling a pending unconfirmed action, the UI lifecycle handles it.',
      'For corrections to an operation, use update_transaction and identify target with target/transaction fields.',
      'For first account or missing account cases, provide known fields and leave missing fields empty; validator will ask the needed question.',
      'For VOICE_SESSION_COMMAND, produce exactly one final plan after applying corrections. Never execute both old and corrected meanings.',
      'For off-topic or capability questions, return reply mode with empty actions unless a show_* tool directly matches.',
      'For English USER messages, set language to "en" in the plan. For Russian USER messages, set language to "ru".',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('\n');
  }


  private async runToolRecoveryPlanner(command: string, context: unknown): Promise<Record<string, unknown>> {
    return this.provider.generateJson<Record<string, unknown>>({
      system: [
        'Return ONLY strict JSON. No markdown. No prose.',
        'A previous planning pass returned no actions. Re-check whether the USER is asking for an app data operation.',
        'Do not extract by regex or hard-coded parsing. Use semantic intent and the tool contract only.',
        'If a matching app tool exists, return an actions plan. Use reply with empty actions only for true casual/off-topic messages.',
        'Read-only app requests are still tool requests: accounts, balances, transactions, goals, categories, analytics, limits, obligations and upcoming payments.',
        'Spending limits are managed with create_spending_limit, update_spending_limit, delete_spending_limit, show_spending_limits.',
        'Loans, credits, installments, subscriptions, reminders and upcoming required payments are managed with obligation tools.',
      ].join(' '),
      prompt: [
        'TOOLS:',
        getPlannerToolContract(),
        'CTX:', JSON.stringify(context),
        'USER:', command,
        'Return the best tool plan JSON in this schema: {"mode":"actions","language":"ru|en","summary":"...","actions":[{"tool":"...","input":{...}}]}.',
      ].join(''),
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 12_000,
      numPredict: 640,
    });
  }

  private async runFocusedPlanner(command: string, context: unknown): Promise<Record<string, unknown>> {
    const focusedContext = this.focusContext(context);

    return this.provider.generateJson<Record<string, unknown>>({
      system: [
        'Return ONLY strict JSON. No markdown. No prose.',
        'Use only tool calls from the provided contract.',
        'The current USER message is absolute source of truth.',
        'Do not use examples, regex patterns, word lists, or shortcut extraction to infer financial data.',
        'Resolve intent semantically from the full user request, CTX, and the tool contract.',
        'Do not reuse names from context, memory, or previous commands when USER gives a new exact name.',
        'If the request requires multiple financial actions, return multiple tool calls in order.',
        'If meaning is unclear, return a minimal safe action plan with missing/null ambiguous fields for validator clarification.',
        'For transactions, separate category/section from merchant/place/items/tags. Preserve named goods/services in items. Never copy the raw user sentence as title.',
        'For VOICE_SESSION_COMMAND, merge segments into one final intent. Later correction segments override conflicting earlier details. Preserve earlier non-conflicting details.',
      ].join(' '),
      prompt: [
        'TOOLS:',
        getPlannerToolContract(),
        'PLANNING_GUIDE:',
        'Use only listed tools.',
        'No hard-coded phrase handling. No phrase-list financial extraction behavior.',
        'Exact quoted names must be copied exactly.',
        'For account operations, goals, taxonomy, transactions, transfers, analytics, settings, onboarding: choose the matching tool from the contract. For analytics by a concrete word or place, pass that word in query_analytics.filter/search/category.',
        'Savings goals must use create_goal. Never turn a goal target into an expense or income transaction.',
        'For first-account setup continuations, create the account and keep the original request moving in the same plan where safe.',
        'Edits to existing operations must use update_transaction, not create_transaction.',
        'For off-topic, return reply with empty actions.',
        'Limits and obligations are first-class app data. Do not answer with free-tier text when a tool exists in the contract.',
        'Pass user-provided natural names through as tool input values. For amount fields, return unambiguous compact amounts as plain numeric values; if unsure, leave amount missing.',
        'For mixed purchases with one total amount, do not create several expenses. Use one create_transaction and keep named goods/services in items plus place details in merchant/place, tags or description.',
        'Keep user-provided account/category/section labels natural. Context is not a picklist and must not override the user message.',
        'If no category/section fits confidently, leave category/section empty instead of misclassifying. A place is not a category.',
        'Do not copy the raw spoken phrase as a transaction name or title. Use a short clean title and keep store/place/items/tags as structured context fields.',
        'CONTEXT:', JSON.stringify(focusedContext),
        'USER:', command,
      ].join('\n'),
      temperature: 0,
      modelRole: 'base',
      timeoutMs: 18_000,
      numPredict: 760,
    });
  }

  private async reviewPlanAgainstContract(command: string, context: unknown, draft: AIPlan): Promise<AIPlan | null> {
    try {
      const raw = await this.provider.generateJson<Record<string, unknown>>({
        system: [
          'Return ONLY strict JSON. No markdown. No prose.',
          'You are reviewing an AI financial tool plan against the current USER message and tool contract.',
          'Do not use regex, keyword shortcuts, rule tables, examples, or hard-coded financial mappings.',
          'Use semantic comparison only: every meaningful detail from USER must be represented in the structured fields or deliberately left missing for validation clarification.',
          'Preserve correct tool choices and amounts. Do not create extra actions unless the USER clearly requested more than one action.',
          'For create_transaction, category/section describe financial purpose; merchant/place describe where it happened; items/tags/description preserve concrete purchase context.',
          'If USER mentions concrete purchased goods/services/components and the draft omitted them, add them to items as a string array or to tags/description when items is unsuitable.',
          'If USER gives one total for multiple goods/services, keep exactly one create_transaction and do not invent per-item prices.',
          'If draft uses a generic category/section such as Expense/Income/Расход/Доход only to avoid an empty field, remove that field. Validator can ask or use fallback safely.',
          'Keep title short and clean. Do not copy the full command and do not use merchant plus item list as title.',
          'If the draft missed an obligation, payment, subscription or spending-limit tool, correct the tool family instead of returning reply/unclear.',
        ].join(' '),
        prompt: [
          'TOOLS:',
          getPlannerToolContract(),
          'CTX:', JSON.stringify(context),
          'USER:', command,
          'DRAFT_PLAN:', JSON.stringify(draft),
          'Return the corrected full plan JSON in the same schema: {"mode":"actions","summary":"...","actions":[{"tool":"...","input":{...}}]}.',
        ].join('\n'),
        temperature: 0,
        modelRole: 'fast',
        timeoutMs: 12_000,
        numPredict: 760,
      });

      const reviewed = this.normalizePlan(raw, command);
      return reviewed.actions.length ? reviewed : null;
    } catch (error) {
      console.warn('[AI] planner contract review skipped', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private focusContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;

    return {
      accountContext: this.safeAccountContext(value),
      taxonomyContext: this.safeTaxonomyContext(value),
      goals: Array.isArray(value.goals) ? value.goals.slice(0, 8).map((item) => item.title).filter(Boolean) : [],
      obligations: Array.isArray(value.obligations) ? value.obligations.slice(0, 8).map((item) => item.title).filter(Boolean) : [],
    };
  }



  private compactAliasList(value: unknown, limit: number) {
    return Array.isArray(value)
      ? value.slice(0, limit).map((item) => {
        const record = this.asRecord(item);
        return {
          name: typeof record.name === 'string' ? record.name : '',
          aliases: Array.isArray(record.aliases) ? record.aliases.slice(0, 5).filter((alias) => typeof alias === 'string') : [],
        };
      }).filter((item) => item.name)
      : [];
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    const memory = value.memory && typeof value.memory === 'object' ? value.memory : {};

    return {
      accountContext: this.safeAccountContext(value),
      taxonomyContext: this.safeTaxonomyContext(value),
      goals: Array.isArray(value.goals)
        ? value.goals.slice(0, 8).map((goal) => ({
          title: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          currency: goal.currency,
          status: goal.status,
        }))
        : [],
      goalAliases: this.compactAliasList(memory.goalAliases, 8),
      preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(0, 6) : [],
      aiSettings: value.aiSettings
        ? {
          preset: value.aiSettings.preset,
          hasDefaultExpenseAccount: Boolean(value.aiSettings.defaultExpenseAccountId),
          hasDefaultIncomeAccount: Boolean(value.aiSettings.defaultIncomeAccountId),
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
      obligations: Array.isArray(value.obligations)
        ? value.obligations.slice(0, 8).map((item) => ({
          title: item.title,
          type: item.type,
          monthlyPayment: item.monthlyPayment,
          currentDebt: item.currentDebt,
          currency: item.currency,
          status: item.status,
          nextPaymentDate: item.nextPaymentDate,
        }))
        : [],
      obligationReminders: Array.isArray(value.obligationReminders)
        ? value.obligationReminders.slice(0, 8).map((item) => ({
          title: item.title,
          dueDate: item.dueDate,
          remindAt: item.remindAt,
          status: item.status,
        }))
        : [],
      recentTransactions: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.slice(0, 6).map((item) => ({
          id: item.id,
          type: item.type,
          amount: item.amount,
          description: item.description,
          createdAt: item.createdAt,
        }))
        : [],
    };
  }

  private safeAccountContext(value: UserContext) {
    const accounts = Array.isArray(value.accounts) ? value.accounts : [];
    const typeCounts = accounts.reduce<Record<string, number>>((acc, account) => {
      const type = typeof account.type === 'string' && account.type ? account.type : 'unknown';
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      count: accounts.length,
      typeCounts,
      currencies: Array.from(new Set(accounts.map((account) => account.currency).filter(Boolean))).slice(0, 4),
    };
  }

  private safeTaxonomyContext(value: UserContext) {
    const categories = Array.isArray(value.categories) ? value.categories : [];
    const sections = Array.isArray(value.sections) ? value.sections : [];

    return {
      categoryCount: categories.length,
      sectionCount: sections.length,
      hasExpenseCategories: categories.some((category) => category.type === 'expense'),
      hasIncomeCategories: categories.some((category) => category.type === 'income'),
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


    const language = this.asOptionalString(raw.language) ?? aiLanguageService.detectFromText(command);

    return {
      mode: 'actions',
      language,
      summary: this.asOptionalString(raw.summary) ?? (actions.length ? (language === 'en' ? 'Action prepared.' : 'Действие подготовлено.') : (language === 'en' ? 'I can answer briefly and help with finances.' : 'Я рядом. Могу ответить коротко и помочь с финансами.')),
      actions,
    };
  }


  private normalizeAction(item: Record<string, unknown>, command: string): AIToolCall | null {
    const rawTool = typeof item.tool === 'string' ? item.tool : typeof item.name === 'string' ? item.name : '';
    const input = this.asRecord(item.input ?? item.params ?? item.args ?? item.arguments);

    const alias = this.normalizeToolAlias(rawTool);
    if (!alias) return null;

    const nextInput = { ...input, ...alias.extraInput, __userText: command };

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

    if (lower === 'edit_transaction' || lower === 'change_transaction' || lower === 'update_operation' || lower === 'edit_operation') {
      return { tool: 'update_transaction', extraInput: {} };
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
