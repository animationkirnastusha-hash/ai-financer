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
      timeoutMs: 25_000,
      numCtx: 768,
      numPredict: 64,
    });

    let plan = this.normalizePlan(raw, command, false);

    if (plan.mode === 'question' && this.shouldRepairAsAction(command, plan.answer)) {
      const repaired = await this.provider.generateJson<Record<string, unknown>>({
        system: this.systemPrompt(),
        prompt: this.buildRepairPrompt(command, compactContext),
        temperature: 0,
        modelRole: 'fast',
        timeoutMs: 25_000,
        numCtx: 768,
        numPredict: 64,
      });

      plan = this.normalizePlan(repaired, command, true);
    }

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.mode === 'actions' ? plan.actions.map((action) => action.tool) : [],
    });

    return plan;
  }

  private systemPrompt() {
    return 'Return ONLY JSON. No markdown. Convert text to app tool calls. Bare item + amount = expense. Missing account=null. Questions/advice => mode question.';
  }

  private buildPrompt(command: string, context: unknown) {
    return [
      'Schema actions: {"mode":"actions","summary":"...","actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":300,"account":null,"category":"Кофе","description":"Кофе"}}]}',
      'Schema question: {"mode":"question","answer":"..."}',
      'Tools:', getPlannerToolContract(),
      'Ctx:', JSON.stringify(context),
      'User:', command,
    ].join('\n');
  }

  private buildRepairPrompt(command: string, context: unknown) {
    return [
      'Previous result was not executable. Build ACTIONS only if the user mentions an app action or money amount.',
      'For bare item + amount, output create_transaction expense.',
      'Use this exact shape:',
      '{"mode":"actions","summary":"Проверь действие перед выполнением.","actions":[{"tool":"create_transaction","input":{"kind":"expense","amount":300,"account":null,"category":"Кофе","description":"Кофе"}}]}',
      'TOOLS:',
      getPlannerToolContract(),
      'CONTEXT:',
      JSON.stringify(context),
      'USER:',
      command,
    ].join('\n');
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 3).map((account) => account.name).filter(Boolean)
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 5).map((category) => category.name).filter(Boolean)
        : [],
      sections: [],
    };
  }

  private normalizePlan(raw: Record<string, unknown>, command: string, repaired: boolean): AIPlan {
    const rawActions = Array.isArray(raw.actions)
      ? raw.actions
      : Array.isArray(raw.toolCalls)
        ? raw.toolCalls
        : [];

    const actions: AIToolCall[] = rawActions
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item): AIToolCall | null => this.normalizeAction(item, command))
      .filter((action): action is AIToolCall => action !== null);

    if (actions.length > 0) {
      return {
        mode: 'actions',
        language: this.asOptionalString(raw.language),
        summary: this.asOptionalString(raw.summary) ?? 'Проверь действие перед выполнением.',
        actions,
      };
    }

    return {
      mode: 'question',
      language: this.asOptionalString(raw.language),
      answer: this.asOptionalString(raw.answer)
        ?? (repaired
          ? 'Не удалось подготовить безопасное действие. Напиши коротко: действие, сумма, счёт.'
          : 'Не удалось распознать действие.'),
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
      return { tool: 'create_transaction', extraInput: { kind: 'expense' } };
    }

    return null;
  }

  private shouldRepairAsAction(command: string, answer: string) {
    const text = `${command} ${answer}`.toLowerCase();
    const hasDigit = /\d/.test(text);
    const hasMoneyWord = /руб|₽|usd|eur|vnd|доллар|евро|к\b|тыс|тыщ|доход|зарплат|расход|трата|потрат|кофе|еда|такси|магазин|продукт|бензин|создай|переведи|положи|закинь/.test(text);
    return hasDigit || hasMoneyWord;
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
