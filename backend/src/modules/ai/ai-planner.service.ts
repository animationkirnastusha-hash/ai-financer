import { AIPlan, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY, buildToolCatalogPrompt, getToolDefinition } from './tools/tool-registry';

const TOOL_NAMES = new Set(AI_TOOL_REGISTRY.map((tool) => tool.name));
const DEBUG_AI = process.env.AI_DEBUG === '1' || process.env.AI_DEBUG === 'true';

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
      'You are the planning brain of a finance app.',
      'Return ONLY one minified JSON object. No markdown. No prose.',
      'Every user request must become either actions, question, or clarification.',
      'Use actions when the user asks to create/edit/delete/show money data.',
      'Do not ask for optional fields. Defaults: currency=RUB, account type=null unless obvious.',
      'If user says cash/наличка/наличные => account type cash.',
      'If user says card/карта/bank/банк => account type card.',
      'If user says savings/копилка/накопления => account type savings.',
      'Account name is the label only. Remove command words: create, account, add, deposit, named, с названием, назови, положи, добавь.',
      'Top up/deposit/put/add money/положи/добавь/закинь/пополнить => create_transaction kind=income.',
      'Spend/buy/pay/купил/потратил/оплатил => create_transaction kind=expense.',
      'Use "there/туда/на него" as the account created in the previous action.',
      'Amounts: 10 тысяч/десять тысяч/10k/10к/10 thousand => 10000. Preserve currency if mentioned.',
      'Shape: {"mode":"actions","language":"ru","summary":"...","actions":[{"tool":"create_account","input":{"name":"наличка","type":"cash","currency":"RUB"},"reason":"..."}]}',
    ].join('\n');

    const prompt = [
      `TOOLS:\n${buildToolCatalogPrompt()}`,
      `CURRENT_DATA:\n${JSON.stringify(this.compactContext(context))}`,
      `USER_TEXT:\n${command}`,
      'Return JSON only now.',
    ].join('\n\n');

    const raw = await this.provider.generateJson<PlannerRaw>({
      system,
      prompt,
      temperature: 0,
      timeoutMs: Number(process.env.AI_LLM_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || 60_000),
      numCtx: Number(process.env.OLLAMA_NUM_CTX || 1024),
      numPredict: Number(process.env.OLLAMA_NUM_PREDICT || 160),
    });

    if (DEBUG_AI) {
      console.log('[AI] planner raw', JSON.stringify(raw).slice(0, 4000));
    }

    const plan = this.normalizePlan(raw);

    console.log('[AI] planner normalized', {
      mode: plan.mode,
      actions: plan.mode === 'actions' ? plan.actions.map((action) => action.tool) : [],
      missing: plan.mode === 'clarification' ? plan.missing : [],
    });

    return plan;
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
            input: this.normalizeActionInput(tool as AIToolName, this.asRecord(item.input)),
            reason: typeof item.reason === 'string' ? item.reason : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (actions.length === 0) {
        return {
          mode: 'clarification',
          language: typeof raw.language === 'string' ? raw.language : undefined,
          message: 'Я понял запрос, но не смог безопасно собрать действие. Скажи, что нужно изменить в финансах.',
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

  private normalizeActionInput(tool: AIToolName, input: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...input };

    if (tool === 'create_account') {
      const rawName = this.asText(result.name);
      result.name = this.cleanAccountName(rawName);
      result.currency = this.normalizeCurrency(result.currency) || 'RUB';

      const type = this.asText(result.type).toLowerCase();
      if (!type) result.type = this.inferAccountType(String(result.name));
    }

    if (tool === 'create_transaction') {
      result.currency = this.normalizeCurrency(result.currency) || undefined;
      const kind = this.asText(result.kind).toLowerCase();
      if (kind !== 'income' && kind !== 'expense') result.kind = 'expense';
    }

    return result;
  }

  private cleanAccountName(value: string) {
    return value
      .replace(/^(создай|создать|добавь|добавить|открой|открыть|create|add|open)\s+/i, '')
      .replace(/^(сч[её]т|account|wallet|кошел[её]к)\s+/i, '')
      .replace(/\s+(и\s+)?(положи|добавь|закинь|пополнить|пополнение|депозит|deposit|top\s*up|add)\b[\s\S]*$/i, '')
      .replace(/^(с\s+названием|назови\s+его|назови|named|called)\s+/i, '')
      .replace(/\b(рубл[ьяей]*|руб|доллар[аов]*|доллар|евро|usd|rub|eur|vnd)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Новый счёт';
  }

  private inferAccountType(name: string) {
    const normalized = name.toLowerCase();
    if (/нал|cash/.test(normalized)) return 'cash';
    if (/карт|card|банк|bank/.test(normalized)) return 'card';
    if (/накоп|копил|saving/.test(normalized)) return 'savings';
    return null;
  }

  private normalizeCurrency(value: unknown) {
    const raw = this.asText(value).toUpperCase();
    if (['RUB', 'USD', 'EUR', 'VND'].includes(raw)) return raw;
    if (/РУБ|RUBLE|₽/.test(raw)) return 'RUB';
    if (/ДОЛ|DOLLAR|\$/.test(raw)) return 'USD';
    if (/ЕВРО|EURO|€/.test(raw)) return 'EUR';
    if (/DONG|VND|₫/.test(raw)) return 'VND';
    return '';
  }

  private compactContext(context: unknown) {
    const source = this.asRecord(context);
    const accounts = Array.isArray(source.accounts) ? source.accounts : [];
    const categories = Array.isArray(source.categories) ? source.categories : [];
    const sections = Array.isArray(source.sections) ? source.sections : [];

    return {
      accounts: accounts.slice(0, 8).map((item) => {
        const account = this.asRecord(item);
        return {
          name: typeof account.name === 'string' ? account.name : '',
          type: typeof account.type === 'string' ? account.type : '',
          currency: typeof account.currency === 'string' ? account.currency : '',
        };
      }),
      categories: categories.slice(0, 10).map((item) => {
        const category = this.asRecord(item);
        return {
          name: typeof category.name === 'string' ? category.name : '',
          type: typeof category.type === 'string' ? category.type : '',
        };
      }),
      sections: sections.slice(0, 8).map((item) => {
        const section = this.asRecord(item);
        return { name: typeof section.name === 'string' ? section.name : '' };
      }),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private asText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
