import { AIPlan, AIToolCall, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string }>;
};

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system: this.systemPrompt(),
      prompt: this.buildPrompt(command, this.compactContext(context)),
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 18_000,
      numCtx: 768,
      numPredict: 64,
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
      'You are AI-financer planner.',
      'Return ONLY JSON.',
      'No markdown. No prose. No questions.',
      'Shape: {"actions":[{"tool":"create_transaction|create_account|transfer_money|show_accounts|show_transactions","input":{}}]}',
      'For money amounts copy the exact user amount phrase into input.amount, e.g. "30 тысяч рублей", "5к", "300".',
      'If it is an app command, actions MUST NOT be empty.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'RULES:',
      '- expense/purchase/payment: create_transaction kind expense.',
      '- income/salary/top-up/deposit/put money to account: create_transaction kind income.',
      '- create account: create_account.',
      '- create account and put money there: create_account then create_transaction kind income to same account.',
      '- transfer between accounts: transfer_money.',
      'EXAMPLES:',
      'кофе 300 -> {"actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":"300","currency":"RUB","account":null,"category":"Кофе","description":"Кофе"}}]}',
      'доход 30 тысяч рублей -> {"actions":[{"tool":"create_transaction","input":{"kind":"income","amount":"30 тысяч рублей","currency":"RUB","account":null,"category":"Доход","description":"Доход"}}]}',
      'положи на счет наличка 35 тысяч рублей -> {"actions":[{"tool":"create_transaction","input":{"kind":"income","amount":"35 тысяч рублей","currency":"RUB","account":"наличка","category":"Пополнение","description":"Пополнение наличка"}}]}',
      'создай счет наличка -> {"actions":[{"tool":"create_account","input":{"name":"наличка","type":"cash","currency":"RUB","initialBalance":0}}]}',
      'создай счет наличка и положи туда 5к -> {"actions":[{"tool":"create_account","input":{"name":"наличка","type":"cash","currency":"RUB","initialBalance":0}},{"tool":"create_transaction","input":{"kind":"income","amount":"5к","currency":"RUB","account":"наличка","category":"Пополнение","description":"Пополнение наличка"}}]}',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('\n');
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 8).map((account) => account.name).filter(Boolean)
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 8).map((category) => category.name).filter(Boolean)
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
      summary: actions.length ? 'Действие подготовлено.' : 'Нет действий',
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
    if (this.isToolName(clean)) return { tool: clean, extraInput: {} };

    const lower = clean.toLowerCase();
    if (lower === 'create_expense' || lower === 'add_expense' || lower === 'expense') return { tool: 'create_transaction', extraInput: { kind: 'expense' } };
    if (lower === 'create_income' || lower === 'add_income' || lower === 'income' || lower === 'deposit' || lower === 'top_up') return { tool: 'create_transaction', extraInput: { kind: 'income' } };
    if (lower === 'transfer_between_accounts' || lower === 'transfer') return { tool: 'transfer_money', extraInput: {} };
    return null;
  }

  private isToolName(value: string): value is AIToolName {
    return TOOL_NAMES.has(value as AIToolName);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
