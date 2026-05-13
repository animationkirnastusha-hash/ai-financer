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
    const system = [
      'You are AI-financer planning core.',
      'Return ONLY JSON.',
      'No prose. No markdown. No thinking.',
      'Output shape: {"mode":"actions","summary":"...","actions":[{"tool":"...","input":{}}]} OR {"mode":"question","answer":"...","actions":[]}.',
      'Never ask clarification for simple finance records.',
      'Bare item/service + amount is always expense.',
      'Examples: "кофе 300" -> create_transaction expense amount 300 category "Кофе" description "Кофе" account null.',
      'Examples: "кофе 300 наличные" -> create_transaction expense amount 300 category "Кофе" description "Кофе" account "наличные".',
      'Income words: зарплата, доход, получил, поступило, пополнение.',
      'Create/update/delete/transfer/stat requests must be actions.',
      'Advice/explanation only must be question.',
    ].join(' ');

    const prompt = [
      'TOOLS:',
      getPlannerToolContract(),
      'USER_CONTEXT:',
      JSON.stringify(this.compactContext(context)),
      'USER_TEXT:',
      command,
    ].join('\n');

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system,
      prompt,
      temperature: 0,
      modelRole: 'fast',
      timeoutMs: 25_000,
      numCtx: 768,
      numPredict: 64,
    });

    const plan = this.normalizePlan(raw, command);

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.mode === 'actions' ? plan.actions.map((action) => action.tool) : [],
    });

    return plan;
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
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 6).map((section) => section.name).filter(Boolean)
        : [],
    };
  }

  private normalizePlan(raw: Record<string, unknown>, command: string): AIPlan {
    const mode = raw.mode === 'question' ? 'question' : 'actions';

    if (mode === 'question') {
      return {
        mode: 'question',
        language: this.asOptionalString(raw.language),
        answer: this.asOptionalString(raw.answer) ?? 'Я могу ответить на финансовый вопрос или подготовить действие в приложении.',
      };
    }

    const rawActions = Array.isArray(raw.actions)
      ? raw.actions
      : Array.isArray(raw.toolCalls)
        ? raw.toolCalls
        : [];

    const actions: AIToolCall[] = rawActions
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item): AIToolCall | null => {
        const rawTool = typeof item.tool === 'string' ? item.tool : typeof item.name === 'string' ? item.name : '';
        if (!this.isToolName(rawTool)) return null;

        const input = this.asRecord(item.input ?? item.params ?? item.args ?? item.arguments);
        input.__userText = command;
        const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined;
        return reason ? { tool: rawTool, input, reason } : { tool: rawTool, input };
      })
      .filter((action): action is AIToolCall => action !== null);

    if (actions.length === 0) {
      return {
        mode: 'question',
        language: this.asOptionalString(raw.language),
        answer: 'Не получил безопасный план действий. Напиши одной фразой действие и сумму, например: "кофе 300".',
      };
    }

    return {
      mode: 'actions',
      language: this.asOptionalString(raw.language),
      summary: this.asOptionalString(raw.summary) ?? 'Проверь действие перед выполнением.',
      actions,
    };
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
