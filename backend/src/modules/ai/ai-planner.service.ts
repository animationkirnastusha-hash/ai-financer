import { AIPlan, AIToolCall, AIToolName } from './types';
import { createAIProvider } from './providers/ai-provider.factory';
import { AI_TOOL_REGISTRY, getPlannerToolContract } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string }>;
  categories?: Array<{ name?: string; type?: string }>;
};

export class AIPlannerService {
  private readonly provider = createAIProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const compactContext = this.compactContext(context);

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system: this.systemPrompt(),
      prompt: this.buildPrompt(command, compactContext),
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 8_000,
      numCtx: 640,
      numPredict: 160,
    });

    const plan = this.normalizePlan(raw, command);

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.actions.map((action) => action.tool),
    });

    return plan;
  }

  private systemPrompt() {
    return 'Return ONLY JSON: {"mode":"actions","actions":[{"tool":"create_transaction","input":{"kind":"income|expense","amount":"string|number","account":"string|null","category":"string|null","description":"string|null","currency":"RUB"}}]}. No prose. No markdown. Never ask questions.';
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'TOOLS:',
      getPlannerToolContract(),
      'RULES:',
      'income/deposit/top-up/salary => create_transaction kind income.',
      'expense/payment/purchase/item+amount => create_transaction kind expense.',
      'create account => create_account initialBalance 0 unless user explicitly says initial balance.',
      'create account and put/add money => create_account initialBalance 0 + create_transaction income to that account.',
      'Preserve spoken amounts exactly: "30 тысяч рублей", "30 000 руб", "5к".',
      'Use account names from CTX when present.',
      'CTX:', JSON.stringify(context),
      'USER:', command,
    ].join('\n');
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 4).map((account) => account.name).filter(Boolean)
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 4).map((category) => category.name).filter(Boolean)
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
      summary: this.asOptionalString(raw.summary) ?? (actions.length ? 'Действие подготовлено.' : 'Нет действий'),
      actions,
    };
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
