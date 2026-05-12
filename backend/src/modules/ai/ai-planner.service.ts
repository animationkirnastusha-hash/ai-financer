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
      'You are a finance app planner. Return ONLY compact JSON.',
      'Plan backend tool calls from natural text. Do not execute.',
      'Use only listed tools. Preserve action order.',
      'Deposits/top-ups/put/add money to account => create_transaction kind income.',
      'Spending/buying/payments => create_transaction kind expense.',
      'Transfers/move money between accounts => transfer_money.',
      'Account name is only the label, not command words.',
      'Support RU/EN/VI/mixed. Amounts: 10 тысяч, 10k, 10 thousand => 10000.',
      'JSON shape: {"mode":"actions|question|clarification","language":null,"summary":null,"answer":null,"message":null,"missing":[],"actions":[{"tool":"create_account","input":{"name":"Наличка","type":"cash","currency":"RUB","initialBalance":0},"reason":"short"}]}',
    ].join('\n');

    const prompt = [
      `TOOLS:\n${buildToolCatalogPrompt()}`,
      `CONTEXT:\n${JSON.stringify(this.compactContext(context))}`,
      `USER:\n${command}`,
      'Return JSON only. No markdown. No extra keys outside the shape.',
    ].join('\n\n');

    const raw = await this.provider.generateJson<PlannerRaw>({
      system,
      prompt,
      temperature: 0,
      timeoutMs: 45_000,
      numCtx: 1024,
      numPredict: 160,
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
          message: 'Я понял запрос, но не смог безопасно собрать действие. Сформулируй, что нужно изменить в финансах.',
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
      accounts: accounts.slice(0, 12).map((item) => {
        const account = this.asRecord(item);
        return {
          name: typeof account.name === 'string' ? account.name : '',
          type: typeof account.type === 'string' ? account.type : '',
          currency: typeof account.currency === 'string' ? account.currency : '',
        };
      }),
      categories: categories.slice(0, 16).map((item) => {
        const category = this.asRecord(item);
        return {
          name: typeof category.name === 'string' ? category.name : '',
          type: typeof category.type === 'string' ? category.type : '',
        };
      }),
      sections: sections.slice(0, 10).map((item) => {
        const section = this.asRecord(item);
        return { name: typeof section.name === 'string' ? section.name : '' };
      }),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
