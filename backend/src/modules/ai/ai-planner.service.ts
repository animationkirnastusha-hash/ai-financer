import { AIPlan, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY, buildToolCatalogPrompt, getToolDefinition } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));

type PlannerRawAction = {
  tool?: unknown;
  input?: unknown;
  reason?: unknown;
};

type PlannerRaw = {
  mode?: unknown;
  language?: unknown;
  summary?: unknown;
  answer?: unknown;
  message?: unknown;
  missing?: unknown;
  actions?: unknown;
};

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const system = [
      'You are the AI planner inside a personal finance app.',
      'Understand natural user text and return a JSON plan for backend tools.',
      'Never execute actions. Only plan.',
      'Use tools only from TOOL_CATALOG.',
      'One message can contain multiple actions. Preserve order.',
      'If the user changes app data, use mode "actions".',
      'If the user only asks a question, use mode "question".',
      'If essential data is missing, use mode "clarification".',
      'Do not invent existing account ids. Use visible account/category/section names from CONTEXT when possible.',
      'Deposits/top-ups/put money onto account = create_transaction with kind "income".',
      'Spending/buying/paying = create_transaction with kind "expense".',
      'Moving money between accounts = transfer_money.',
      'Account name is only the human label. Do not include command words like "create", "deposit", "called", "назови", "положи" in name.',
      'If user says "create card account named X", account type is card and name is X.',
      'If user says "cash / наличка", type is cash unless they clearly mean account name.',
      'If currency is named as account currency, set currency. If currency is part of the explicit account name, keep it in name.',
      'Amounts must be full numeric values: "10 тысяч", "10k", "10 thousand" => 10000.',
      'If unsure, also include original amount text in input.amountText.',
      'Supported languages: Russian, English, Vietnamese, mixed language.',
    ].join('\n');

    const prompt = [
      'Return exactly one JSON object with this shape:',
      '{"mode":"actions|question|clarification","language":"ru|en|vi|mixed|null","summary":"short|null","answer":"short|null","message":"short|null","missing":[],"actions":[{"tool":"tool_name","input":{},"reason":"short"}]}',
      '',
      'TOOL_CATALOG:',
      buildToolCatalogPrompt(),
      '',
      'CONTEXT:',
      JSON.stringify(this.compactContext(context)),
      '',
      'USER_TEXT:',
      command,
    ].join('\n');

    const raw = await this.provider.generateJson<PlannerRaw>({
      system,
      prompt,
      temperature: 0,
      numCtx: 2048,
      numPredict: 256,
    });

    return this.normalizePlan(raw);
  }

  private normalizePlan(raw: PlannerRaw): AIPlan {
    const mode = raw.mode;

    if (mode === 'actions') {
      const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
      const actions = rawActions
        .filter((item): item is PlannerRawAction => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) => {
          const tool = typeof item.tool === 'string' ? item.tool : '';
          if (!TOOL_NAMES.has(tool as AIToolName) || !getToolDefinition(tool)) return null;

          return {
            tool: tool as AIToolName,
            input: this.asRecord(item.input),
            reason: typeof item.reason === 'string' ? item.reason : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (actions.length === 0) {
        return {
          mode: 'clarification',
          language: typeof raw.language === 'string' ? raw.language : undefined,
          message: 'Я понял запрос, но не смог безопасно собрать действие. Сформулируй, что именно нужно изменить в финансах.',
          missing: ['action'],
        };
      }

      return {
        mode: 'actions',
        language: typeof raw.language === 'string' ? raw.language : undefined,
        summary: typeof raw.summary === 'string' ? raw.summary : undefined,
        actions,
      };
    }

    if (mode === 'clarification') {
      return {
        mode: 'clarification',
        language: typeof raw.language === 'string' ? raw.language : undefined,
        message: typeof raw.message === 'string' && raw.message.trim() ? raw.message : 'Нужно уточнение.',
        missing: Array.isArray(raw.missing) ? raw.missing.filter((item): item is string => typeof item === 'string') : [],
      };
    }

    return {
      mode: 'question',
      language: typeof raw.language === 'string' ? raw.language : undefined,
      answer: typeof raw.answer === 'string' && raw.answer.trim()
        ? raw.answer
        : 'Я могу ответить по финансам или подготовить действие в приложении.',
    };
  }

  private compactContext(context: unknown) {
    const source = this.asRecord(context);
    const accounts = Array.isArray(source.accounts) ? source.accounts : [];
    const categories = Array.isArray(source.categories) ? source.categories : [];
    const sections = Array.isArray(source.sections) ? source.sections : [];

    return {
      accounts: accounts.slice(0, 30).map((item) => {
        const account = this.asRecord(item);
        return {
          name: typeof account.name === 'string' ? account.name : '',
          type: typeof account.type === 'string' ? account.type : '',
          currency: typeof account.currency === 'string' ? account.currency : '',
        };
      }),
      categories: categories.slice(0, 40).map((item) => {
        const category = this.asRecord(item);
        return {
          name: typeof category.name === 'string' ? category.name : '',
          type: typeof category.type === 'string' ? category.type : '',
        };
      }),
      sections: sections.slice(0, 30).map((item) => {
        const section = this.asRecord(item);
        return { name: typeof section.name === 'string' ? section.name : '' };
      }),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
