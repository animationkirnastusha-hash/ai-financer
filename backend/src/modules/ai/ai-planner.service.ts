import { AIPlan, AIToolCall, AIToolName } from './types';
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

    if (!plan.actions.length) {
      usedFallback = true;
      console.warn('[AI] planner returned no actions, retrying focused planner once');
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
      'For non-financial small talk, return {"mode":"reply","summary":"short human answer, then gently return to finance context","actions":[]}.',
      'No prose. No markdown. No questions outside JSON.',
      'Use semantic understanding only. Do not rely on keyword rules or regex-like extraction.',
      'Use CTX entity hints as meanings, not as commands: colloquial account/category/goal words may refer to existing user entities even when the endings differ.',
      'Never output accountId/categoryId/sectionId/goalId; backend resolves entities by semantic hints and confidence.',
      'The current USER message is the primary source of truth. Context and memory are secondary only for pronouns or explicit continuations.',
      'Treat voice-recognition text as noisy but meaningful: missing punctuation, spoken numbers, and informal wording are expected. Infer intent from the whole sentence and the available tool contract, not from hard-coded phrases.',
      'If USER contains VOICE_SESSION_COMMAND, treat it as one continuous command assembled from speech segments. Later correction segments override earlier conflicting details, but preserve amounts and entities from earlier segments when they were not explicitly cancelled or replaced.',
      'If voice corrections make the final intent uncertain, return a minimal safe plan and let validator ask clarification. Do not execute both the old and corrected intent.',
      'If USER gives an exact name in quotes, copy it exactly. Do not replace it with memory or an older command.',
      'If the request is materially ambiguous, produce the safest plan that lets validator ask for clarification instead of inventing facts.',
      'Return transaction amount fields as plain positive numbers when the amount is unambiguous. Compact spoken amount forms such as 20к, 20 k, 20 тыс, 20 тысяч, 1.5к mean thousands. Never substitute a different amount. If uncertain, leave amount missing so validator asks clarification.',
      'For create_transaction, use title only for a short clean operation label. Do not copy the full user phrase into title. Put merchant/place and item details into description.',
      'When the user answers a clarification with an informal phrase such as “с налички”, “мой кэш”, or “та самая копилка”, put that phrase into the relevant entity field; backend resolves it semantically.',
      'For screen-opening requests, do not invent financial actions. If no screen tool exists, return reply mode with a short natural acknowledgement; the UI navigation layer may handle it.',
      'Do not include examples in reasoning or outputs. Do not implement phrase-specific behavior in planner instructions.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'RULES:',
      'Use only listed tools.',
      'Do not parse the command with rules. Plan by semantic meaning and tool contracts only. No regex-like financial extraction and no rule-based financial extraction.',
      'Do not invent unavailable fields. Use natural entity names, user wording, or CTX entity names; backend validator resolves them semantically.',
      'If the user says something unrelated to finance, answer briefly and meaningfully in summary, but do not create actions and do not pretend to save memory.',
      'For analytics questions, use query_analytics.',
      'For loans, credits, mortgages, installments, subscriptions and required recurring payments, use obligation tools, not normal transactions. Normal transaction is only for a single finished expense/income.',
      'If the user says they have a credit/loan/mortgage/installment/subscription, create an obligation. If they say they paid it, use mark_obligation_paid.',
      'For undo/cancel last completed operation, use undo_last_action.',
      'For companion/reactions, use show_companion_reactions.',
      'For premium/tariff/capabilities, use show_premium_capabilities.',
      'For financial mutations, choose the relevant financial tool from the contract: transactions, transfers, accounts, goals, taxonomy, settings, or onboarding.',
      'Savings goals are not expenses and not income. A phrase about creating, saving for, or collecting money toward a goal must use create_goal; the amount is targetAmount, not a transaction amount.',
      'If a command is a continuation after first-account setup, create the account from the user account answer and then continue the original requested action. If the original action still lacks an amount, leave that amount missing so the validator asks a short follow-up.',
      'When the user says they have money in a new place/account, treat it as account setup plus balance/income to that account, not as an expense from an existing account.',
      'Do not return both clarification-only intent and executable confirmation for the same action. If essential data is missing, leave it missing and let validator ask only clarification.',
      'For VOICE_SESSION_COMMAND, produce exactly one final coherent plan from all segments. Correction segments such as “нет”, “стой”, “лучше”, “замени”, “исправь” mean the later segment changes the earlier conflicting part. Keep non-conflicting details such as amount if the user did not cancel them.',
      'If the user asks to change, edit, fix, correct, rename or update an existing operation/transaction, use update_transaction. Do not create a new transaction for corrections to existing records.',
      'For every transaction, provide category and section when the meaning is clear from the whole request; leave them absent only when genuinely unclear.',
      'Do not use a shop/place/merchant as the transaction title when the user describes what was bought. Put place/merchant into description, and keep the title/category based on the purchase meaning.',
      'If one total amount contains several item meanings without item-level prices, create one transaction only. Do not split the amount. Put the item meanings into description so backend can show them as one mixed purchase card.',
      'If several actions are needed to satisfy one user request, return several tool calls in the correct order.',
      'Do not use previous commands as source data for names, accounts, amounts, or intent. Current USER message wins. Pending clarification is handled outside planner.',
      'If essential entity remains ambiguous after context, leave the ambiguous field missing/null so validator can ask clarification rather than inventing.',
      'Preserve user-provided amounts and names. For amount fields, return unambiguous compact amounts as plain numeric values; do not invent or round to a different amount.',
      'Use account/category/section/goal names from CTX when the user clearly refers to existing entities. Different endings and colloquial forms may mean the same entity.',
      'If user asks to show/change AI settings, use show_ai_settings/update_ai_settings/apply_ai_settings_preset.',
      'If user asks to start/skip/finish tutorial/onboarding, use restart_onboarding/update_onboarding_state.',
      'For corrections during pending confirmation, output a new action plan that reflects the requested change instead of a conversational reply.',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('\n');
  }

  private async runFocusedPlanner(command: string, context: unknown): Promise<Record<string, unknown>> {
    const focusedContext = this.focusContext(context);

    return this.provider.generateJson<Record<string, unknown>>({
      system: [
        'Return ONLY strict JSON. No markdown. No prose.',
        'Use only tool calls from the provided contract.',
        'The current USER message is absolute source of truth.',
        'Do not use examples, regex patterns, or keyword rules to extract financial data.',
        'Resolve intent semantically from the full user request and the tool contract.',
        'Do not reuse names from context, memory, or previous commands when USER gives a new exact name.',
        'If the request requires multiple financial actions, return multiple tool calls in order.',
        'If meaning is unclear, return a minimal safe action plan with missing/null ambiguous fields for validator clarification.',
        'For VOICE_SESSION_COMMAND, merge segments into one final intent. Later correction segments override conflicting earlier details. Preserve earlier non-conflicting details.',
      ].join(' '),
      prompt: [
        'TOOLS:',
        getPlannerToolContract(),
        'RULES:',
        'Use only listed tools.',
        'No hard-coded phrase handling. No rule-based financial extraction behavior.',
        'Exact quoted names must be copied exactly.',
        'For account operations, goals, taxonomy, transactions, transfers, analytics, settings, onboarding: choose the matching tool from the contract.',
        'Savings goals must use create_goal. Never turn a goal target into an expense or income transaction.',
        'For first-account setup continuations, create the account and keep the original request moving in the same plan where safe.',
        'Edits to existing operations must use update_transaction, not create_transaction.',
        'For off-topic, return reply with empty actions.',
        'Pass user-provided natural names through as tool input values. For amount fields, return unambiguous compact amounts as plain numeric values; if unsure, leave amount missing.',
        'For mixed purchases with one total amount, do not create several expenses. Use one create_transaction and keep details in description.',
        'Do not copy the raw spoken phrase as a transaction name or title. Use a short clean title and keep details in description.',
        'CONTEXT:', JSON.stringify(focusedContext),
        'USER:', command,
      ].join('\n'),
      temperature: 0,
      modelRole: 'base',
      timeoutMs: 18_000,
      numPredict: 520,
    });
  }

  private focusContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts) ? value.accounts.slice(0, 8).map((item) => item.name).filter(Boolean) : [],
      categories: Array.isArray(value.categories) ? value.categories.slice(0, 12).map((item) => item.name).filter(Boolean) : [],
      sections: Array.isArray(value.sections) ? value.sections.slice(0, 12).map((item) => item.name).filter(Boolean) : [],
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
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 8).map((account) => account.name).filter(Boolean)
        : [],
      entityAliases: {
        accounts: this.compactAliasList(memory.accountAliases, 8),
        categories: this.compactAliasList(memory.categoryAliases, 10),
        sections: this.compactAliasList(memory.sectionAliases, 8),
        goals: this.compactAliasList(memory.goalAliases, 8),
      },
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 12).map((category) => category.name).filter(Boolean)
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 12).map((section) => section.name).filter(Boolean)
        : [],
      preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(0, 6) : [],
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
        ? value.recentTransactions.slice(0, 8).map((item) => ({
          id: item.id,
          type: item.type,
          amount: item.amount,
          description: item.description,
          account: item.account?.name,
          category: item.category?.name,
          section: item.section?.name,
          createdAt: item.createdAt,
        }))
        : [],
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


    return {
      mode: 'actions',
      language: this.asOptionalString(raw.language),
      summary: this.asOptionalString(raw.summary) ?? (actions.length ? 'Действие подготовлено.' : 'Я рядом. Могу ответить коротко и помочь с финансами.'),
      actions,
    };
  }


  private normalizeAction(item: Record<string, unknown>, command: string): AIToolCall | null {
    const rawTool = typeof item.tool === 'string' ? item.tool : typeof item.name === 'string' ? item.name : '';
    const input = this.asRecord(item.input ?? item.params ?? item.args ?? item.arguments);

    const alias = this.normalizeToolAlias(rawTool);
    if (!alias) return null;

    const nextInput = { ...input, ...alias.extraInput };

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
