import { AIPlan, AIToolCall, AIToolName } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY } from './tools/tool-registry';
import { extractAmountCandidates, extractCurrencyFromText } from './utils/amount-normalizer';

const TOOL_NAMES = new Set<string>(AI_TOOL_REGISTRY.map((tool) => tool.name));

function isToolName(value: unknown): value is AIToolName {
  return typeof value === 'string' && TOOL_NAMES.has(value);
}

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const system = [
      'You are a deterministic semantic planner for an AI-first personal finance app.',
      'Return only JSON. No prose.',
      'Understand meaning, slang and mixed language. Supported user languages: Russian, English, Vietnamese.',
      'You must map user intent to available tools. Do not invent tools.',
      'A single user message may contain many ordered actions.',
      'Rules:',
      '- create account => create_account.',
      '- put/add/deposit/top up/assign money to an account => create_transaction with kind income.',
      '- spend/buy/pay => create_transaction with kind expense.',
      '- move/transfer between accounts => transfer_money.',
      '- account name is only the human label, not command words like “with name”, “named”, “and add deposit”.',
      '- account currency is separate from name. If user says account named “Dollars”, keep name Dollars unless they clearly request USD currency.',
      '- If user creates an account and then says “there/to it/на него/туда”, use the created account name in the next action.',
      '- If missing required information that cannot be inferred, use clarification mode.',
      '',
      'JSON shape:',
      '{"mode":"actions|question|clarification","language":"ru|en|vi|null","summary":"string|null","answer":"string|null","message":"string|null","missing":["field"],"actions":[{"tool":"tool_name","reason":"string|null","input":{}}]}',
    ].join('\n');

    const prompt = JSON.stringify({
      userText: command,
      currentContext: context,
      availableTools: AI_TOOL_REGISTRY.map((tool) => ({ name: tool.name, description: tool.description, input: tool.input })),
      examples: [
        {
          user: 'создай счет карта с названием парламент',
          output: { mode: 'actions', actions: [{ tool: 'create_account', input: { name: 'парламент', type: 'card', currency: null, initialBalance: null } }] },
        },
        {
          user: 'создай счет сигареты и добавь туда депозит 10 тысяч рублей',
          output: { mode: 'actions', actions: [
            { tool: 'create_account', input: { name: 'сигареты', type: null, currency: 'RUB', initialBalance: null } },
            { tool: 'create_transaction', input: { kind: 'income', amount: 10000, currency: 'RUB', account: 'сигареты', category: null, section: null, description: 'депозит' } },
          ] },
        },
      ],
    });

    try {
      const raw = await this.provider.generateJson<Record<string, unknown>>({
        system,
        prompt,
        temperature: 0,
        numCtx: 2048,
        numPredict: 512,
      });
      return this.normalizePlan(raw, command);
    } catch (error) {
      console.error('[AI] planner failed, using safe clarification', error);
      return {
        mode: 'clarification',
        language: 'ru',
        message: 'Я не смог надёжно разобрать запрос. Попробуй повторить короче или разделить на два действия.',
        missing: ['ai_plan'],
      };
    }
  }

  private normalizePlan(raw: Record<string, unknown>, command: string): AIPlan {
    const mode = raw.mode;

    if (mode === 'actions') {
      const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
      const actions = rawActions
        .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item: Record<string, unknown>): AIToolCall | null => {
          const tool = item.tool;
          if (!isToolName(tool)) return null;
          return {
            tool,
            input: this.asRecord(item.input),
            reason: typeof item.reason === 'string' ? item.reason : undefined,
          };
        })
        .filter((item: AIToolCall | null): item is AIToolCall => item !== null);

      const repaired = this.repairActions(actions, command);

      if (repaired.length > 0) {
        return {
          mode: 'actions',
          language: typeof raw.language === 'string' ? raw.language : undefined,
          summary: typeof raw.summary === 'string' ? raw.summary : undefined,
          actions: repaired,
        };
      }
    }

    if (mode === 'clarification') {
      return {
        mode: 'clarification',
        language: typeof raw.language === 'string' ? raw.language : undefined,
        message: typeof raw.message === 'string' && raw.message.trim() ? raw.message : 'Нужно уточнение.',
        missing: Array.isArray(raw.missing) ? raw.missing.filter((item: unknown): item is string => typeof item === 'string') : [],
      };
    }

    if (mode === 'question') {
      return {
        mode: 'question',
        language: typeof raw.language === 'string' ? raw.language : undefined,
        answer: typeof raw.answer === 'string' && raw.answer.trim()
          ? raw.answer
          : 'Я могу помочь с финансами или выполнить действие в приложении.',
      };
    }

    return {
      mode: 'clarification',
      language: 'ru',
      message: 'Я понял запрос не полностью. Уточни сумму, счёт или действие.',
      missing: ['intent'],
    };
  }

  private repairActions(actions: AIToolCall[], command: string): AIToolCall[] {
    const amounts = extractAmountCandidates(command);
    const currency = extractCurrencyFromText(command);
    let lastCreatedAccountName: string | null = null;

    return actions.map((action) => {
      const input = { ...action.input };

      if (action.tool === 'create_account') {
        if (typeof input.name === 'string') input.name = this.cleanAccountName(input.name, command);
        if (input.currency === null || input.currency === undefined) input.currency = currency ?? null;
        if (input.initialBalance === undefined) input.initialBalance = null;
        if (typeof input.name === 'string' && input.name.trim()) lastCreatedAccountName = input.name.trim();
      }

      if (action.tool === 'create_transaction') {
        if ((input.amount === null || input.amount === undefined || Number(input.amount) <= 0) && amounts[0]) input.amount = amounts[0];
        if (input.currency === null || input.currency === undefined) input.currency = currency ?? null;
        if ((!input.account || typeof input.account !== 'string') && lastCreatedAccountName) input.account = lastCreatedAccountName;
      }

      if (action.tool === 'transfer_money') {
        if ((input.amount === null || input.amount === undefined || Number(input.amount) <= 0) && amounts[0]) input.amount = amounts[0];
        if (input.currency === null || input.currency === undefined) input.currency = currency ?? null;
      }

      return { ...action, input };
    });
  }

  private cleanAccountName(value: string, command: string): string {
    const cleaned = value
      .replace(/[«»"]/g, '')
      .replace(/\b(с\s+названием|назови\s+его|назови|named|with\s+name|name\s+it)\b/gi, '')
      .replace(/\b(и\s+добавь|и\s+положи|добавь\s+туда|положи\s+туда|deposit|top\s*up|пополнить|пополнение)\b[\s\S]*$/gi, '')
      .replace(/\b(rub|usd|eur|vnd|рублей|рубля|руб|долларов|доллара|доллары|доллар|евро)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned) return cleaned;

    const marker = command.match(/(?:с\s+названием|назови\s+его|named|with\s+name)\s+([^,.;]+)/i);
    if (marker?.[1]) return marker[1].trim().replace(/[«»"]/g, '');

    return value.trim();
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
