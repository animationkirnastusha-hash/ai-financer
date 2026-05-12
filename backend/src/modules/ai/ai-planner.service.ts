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
      'You are the semantic planner of a finance app.',
      'Your job is to understand user meaning and convert it into app tool actions.',
      'Do not execute anything. Do not chat inside actions. Return JSON only.',
      'Use actions when the user asks to create, change, delete, move, record, assign, show, or manage app data.',
      'Use question only for pure financial advice or information without changing app data.',
      'Use clarification only when required data is truly missing or ambiguous after reading the full user text.',
      'Do not require exact commands. Users may speak naturally in Russian, English, Vietnamese, or mixed language.',
      'Preserve user-provided names as clean human labels. Never include instruction fragments inside names.',
      'Keep explicit currencies and amounts. If amount is written as text, keep that text in amount; backend will normalize it.',
      'If one request contains several actions, return all actions in the correct order.',
    ].join(' ');

    const prompt = [
      'JSON shape:',
      '{"mode":"actions|question|clarification","language":"ru|en|vi|null","summary":"short|null","answer":"short|null","message":"short|null","missing":[],"actions":[{"tool":"tool_name","reason":"short|null","input":{}}]}',
      'Available tools:',
      getPlannerToolContract(),
      'Current app context:',
      JSON.stringify(this.compactContext(context)),
      'User text:',
      command,
    ].join('\n');

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system,
      prompt,
      temperature: 0,
      timeoutMs: 120_000,
      numCtx: 2048,
      numPredict: 220,
    });

    const plan = this.normalizePlan(raw);

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.mode === 'actions' ? plan.actions.map((action) => action.tool) : [],
      missing: plan.mode === 'clarification' ? plan.missing ?? [] : [],
    });

    return plan;
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 16).map((account) => ({ n: account.name, t: account.type, c: account.currency }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 24).map((category) => ({ n: category.name, t: category.type }))
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 16).map((section) => section.name).filter(Boolean)
        : [],
    };
  }

  private normalizePlan(raw: Record<string, unknown>): AIPlan {
    const mode = typeof raw.mode === 'string' ? raw.mode : 'clarification';

    if (mode === 'actions') {
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

          const input = this.asRecord(item.input ?? item.args ?? item.arguments);
          const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined;

          return reason ? { tool: rawTool, input, reason } : { tool: rawTool, input };
        })
        .filter((action): action is AIToolCall => action !== null);

      if (actions.length === 0) {
        return {
          mode: 'clarification',
          language: this.asOptionalString(raw.language),
          message: 'Я понял запрос, но не смог безопасно собрать действие. Сформулируй чуть точнее.',
          missing: ['action'],
        };
      }

      return {
        mode: 'actions',
        language: this.asOptionalString(raw.language),
        summary: this.asOptionalString(raw.summary) ?? 'Проверь действие перед выполнением.',
        actions,
      };
    }

    if (mode === 'question') {
      return {
        mode: 'question',
        language: this.asOptionalString(raw.language),
        answer: this.asOptionalString(raw.answer) ?? 'Я могу помочь с финансами или выполнить действие в приложении.',
      };
    }

    return {
      mode: 'clarification',
      language: this.asOptionalString(raw.language),
      message: this.asOptionalString(raw.message) ?? 'Нужно уточнение.',
      missing: Array.isArray(raw.missing) ? raw.missing.filter((item): item is string => typeof item === 'string') : [],
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
