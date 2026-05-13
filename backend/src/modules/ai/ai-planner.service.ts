import { AIActionPlan, AIToolCall, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string }>;
};

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIActionPlan> {
    const compactContext = this.compactContext(context);

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system: this.systemPrompt(),
      prompt: this.buildPrompt(command, compactContext),
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 20_000,
      numCtx: 768,
      numPredict: 80,
    });

    const plan = this.normalizePlan(raw, command);

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.actions.map((action) => action.tool),
    });

    return plan;
  }

  private systemPrompt() {
    return [
      'You are a backend tool planner.',
      'Return ONLY valid compact JSON.',
      'Never answer with text, questions, markdown, explanations, or null.',
      'Always return {"mode":"actions","summary":"...","actions":[]}.',
      'Use actions:[] only when the user request is not related to the app.',
      'Do not invent tools. Use only listed tools.',
      'For money operations always choose create_transaction or transfer_money.',
      'For income/top-up/salary choose kind income.',
      'For purchases/spending choose kind expense.',
      'For item plus amount choose expense.',
      'For create account plus add money, return create_account then create_transaction income to that account.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'OUTPUT SHAPE:',
      '{"mode":"actions","summary":"short human summary","actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":300,"account":null,"category":"Кофе","description":"Кофе"}}]}',
      'TOOLS:',
      getPlannerToolContract(),
      'EXAMPLES:',
      'User: Кофе 300 => {"mode":"actions","summary":"Добавить расход 300 RUB: Кофе","actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":300,"account":null,"category":"Кофе","description":"Кофе"}}]}',
      'User: Доход 50 тысяч рублей => {"mode":"actions","summary":"Добавить доход 50000 RUB","actions":[{"tool":"create_transaction","input":{"kind":"income","amount":"50 тысяч","account":null,"category":"Доход","description":"Доход"}}]}',
      'User: создай счет наличка и положи туда 5к => {"mode":"actions","summary":"Создать счёт Наличка и добавить 5000 RUB","actions":[{"tool":"create_account","input":{"name":"Наличка","type":"cash","currency":"RUB","initialBalance":0}},{"tool":"create_transaction","input":{"kind":"income","amount":"5к","account":"Наличка","category":"Пополнение","description":"Пополнение счёта"}}]}',
      'CONTEXT:',
      JSON.stringify(context),
      'USER:',
      command,
    ].join('');
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 6).map((account) => account.name).filter(Boolean)
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 8).map((category) => category.name).filter(Boolean)
        : [],
    };
  }

  private normalizePlan(raw: Record<string, unknown>, command: string): AIActionPlan {
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
      summary: this.asOptionalString(raw.summary) ?? this.buildDefaultSummary(actions),
      actions,
    };
  }

  private normalizeAction(item: Record<string, unknown>, command: string): AIToolCall | null {
    const rawTool = typeof item.tool === 'string' ? item.tool : typeof item.name === 'string' ? item.name : '';
    const input = this.asRecord(item.input ?? item.params ?? item.args ?? item.arguments);

    const alias = this.normalizeToolAlias(rawTool, input);
    if (!alias) return null;

    const nextInput = { ...input, ...alias.extraInput };
    nextInput.__userText = command;

    const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined;
    return reason ? { tool: alias.tool, input: nextInput, reason } : { tool: alias.tool, input: nextInput };
  }

  private normalizeToolAlias(rawTool: string, input: Record<string, unknown>): { tool: AIToolName; extraInput: Record<string, unknown> } | null {
    const clean = rawTool.trim();

    if (this.isToolName(clean)) {
      return { tool: clean, extraInput: {} };
    }

    const lower = clean.toLowerCase();

    if (lower === 'create_expense' || lower === 'add_expense' || lower === 'expense') {
      return { tool: 'create_transaction', extraInput: { kind: 'expense' } };
    }

    if (lower === 'create_income' || lower === 'add_income' || lower === 'income') {
      return { tool: 'create_transaction', extraInput: { kind: 'income' } };
    }

    if (lower === 'transfer_between_accounts' || lower === 'transfer') {
      return { tool: 'transfer_money', extraInput: {} };
    }

    if (!clean && (input.amount !== undefined || input.category !== undefined || input.description !== undefined)) {
      return { tool: 'create_transaction', extraInput: {} };
    }

    return null;
  }

  private isToolName(value: string): value is AIToolName {
    return TOOL_NAMES.has(value as AIToolName);
  }

  private buildDefaultSummary(actions: AIToolCall[]) {
    if (actions.length === 0) return 'Не найдено действий для выполнения.';
    if (actions.length === 1) return 'Подготовлено действие.';
    return `Подготовлено действий: ${actions.length}.`;
  }

  private asOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
