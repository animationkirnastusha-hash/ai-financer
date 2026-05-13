import { AIPlan, AIToolCall, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string }>;
  sections?: Array<{ name?: string }>;
};

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const compactContext = this.compactContext(context);

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system: this.systemPrompt(),
      prompt: this.buildPrompt(command, compactContext),
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 20_000,
      numCtx: 768,
      numPredict: 96,
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
      'You are AI-financer action planner.',
      'Return ONLY compact JSON.',
      'Never ask questions.',
      'Never explain.',
      'Never use markdown.',
      'Output shape: {"mode":"actions","summary":"short human summary","actions":[{"tool":"tool_name","input":{}}]}',
      'If the user request is not an app action, return {"mode":"actions","summary":"Нет действий","actions":[]}.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'RULES:',
      '- Use create_transaction for income, expense, deposit/top-up, salary, purchase, payment.',
      '- "положи/пополни/закинь/внеси на счет" means create_transaction kind income.',
      '- Bare item + amount means create_transaction kind expense.',
      '- For "создай счет X и положи туда Y" return TWO actions: create_account, then create_transaction income with account X.',
      '- Preserve amount words in input.amount when user says "тысяч", "к", "млн".',
      '- Use existing account names from context when possible.',
      'EXAMPLES:',
      'User: кофе 300 => {"mode":"actions","summary":"Расход 300 RUB: Кофе","actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":300,"currency":"RUB","account":null,"category":"Кофе","description":"Кофе"}}]}',
      'User: доход 30 тысяч рублей => {"mode":"actions","summary":"Доход 30 тысяч рублей","actions":[{"tool":"create_transaction","input":{"kind":"income","amount":"30 тысяч рублей","currency":"RUB","account":null,"category":"Доход","description":"Доход"}}]}',
      'User: положи на счет наличка 35 тысяч рублей => {"mode":"actions","summary":"Пополнить наличка на 35 тысяч рублей","actions":[{"tool":"create_transaction","input":{"kind":"income","amount":"35 тысяч рублей","currency":"RUB","account":"наличка","category":"Пополнение","description":"Пополнение наличка"}}]}',
      'User: создай счет наличка => {"mode":"actions","summary":"Создать счёт наличка","actions":[{"tool":"create_account","input":{"name":"наличка","type":"cash","currency":"RUB","initialBalance":0}}]}',
      'User: создай счет наличка и положи туда 5к => {"mode":"actions","summary":"Создать счёт наличка и пополнить на 5к","actions":[{"tool":"create_account","input":{"name":"наличка","type":"cash","currency":"RUB","initialBalance":0}},{"tool":"create_transaction","input":{"kind":"income","amount":"5к","currency":"RUB","account":"наличка","category":"Пополнение","description":"Пополнение наличка"}}]}',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('\n');
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 5).map((account) => account.name).filter(Boolean)
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 6).map((category) => category.name).filter(Boolean)
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
      summary: this.asOptionalString(raw.summary) ?? (actions.length ? 'Проверь действие перед выполнением.' : 'Нет действий'),
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
