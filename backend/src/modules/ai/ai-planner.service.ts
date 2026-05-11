import { AIPlan } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY } from './tools/tool-registry';

const plannerSchema = {
  type: 'object',
  properties: {
    mode: { enum: ['actions', 'question', 'clarification'] },
    language: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    answer: { type: ['string', 'null'] },
    message: { type: ['string', 'null'] },
    missing: { type: ['array', 'null'], items: { type: 'string' } },
    actions: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          tool: { enum: AI_TOOL_REGISTRY.map((tool) => tool.name) },
          reason: { type: ['string', 'null'] },
          input: { type: 'object' },
          args: { type: 'object' },
        },
        required: ['tool'],
      },
    },
  },
  required: ['mode'],
} as const;

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const system = [
      'You are the semantic planner for AI-financer, an AI-first personal finance app.',
      'Understand the user like a human assistant, then return a structured action plan.',
      'Do not execute. Do not mention implementation. Return only JSON.',
      '',
      'Core rule: if the user asks to change app data, mode = actions.',
      'A single user message may contain many ordered actions.',
      'Use tools only from availableTools.',
      'Use input, not args. If you output args, backend will normalize it, but input is preferred.',
      '',
      'Important finance semantics:',
      '- deposit / top up / add money / put money / закинь / положи / пополни / присвой balance to account => create_transaction with kind income.',
      '- buy / spend / paid / потратил / купил / оплатил => create_transaction with kind expense.',
      '- move / transfer / переведи / перекинь between two accounts => transfer_money.',
      '- account name is only the human label. Do not include command words in name.',
      '- “с названием X”, “назови его X”, “named X” means account/category/section name is X.',
      '- Account type is separate from name. If type is unclear, use null.',
      '- Currency is separate from name. If user says account named “Доллары”, it can be a name unless they clearly say currency USD.',
      '- If user creates an account and then says “there / туда / ему / на него”, link the following action to that created account by its name.',
      '- Support Russian, English, Vietnamese, and mixed language.',
      '',
      'Return shape:',
      '{"mode":"actions","language":"ru","summary":"short summary","actions":[{"tool":"create_account","reason":"...","input":{...}}]}',
      '{"mode":"clarification","message":"short question","missing":["field"]}',
      '{"mode":"question","answer":"short helpful answer"}',
    ].join('\n');

    const prompt = JSON.stringify({
      userText: command,
      currentContext: context,
      availableTools: AI_TOOL_REGISTRY.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input: tool.input,
      })),
      examples: [
        {
          user: 'создай счет сигареты и добавь туда депозит 10 тысяч рублей',
          json: {
            mode: 'actions',
            language: 'ru',
            summary: 'Создать счёт и добавить депозит.',
            actions: [
              { tool: 'create_account', reason: 'user wants a new account', input: { name: 'сигареты', type: null, currency: 'RUB', initialBalance: null } },
              { tool: 'create_transaction', reason: 'deposit to created account', input: { kind: 'income', amount: '10 тысяч рублей', currency: 'RUB', account: 'сигареты', category: null, section: null, description: 'депозит' } },
            ],
          },
        },
        {
          user: 'create USD account named Vietnam and put 10k there',
          json: {
            mode: 'actions',
            language: 'en',
            summary: 'Create USD account and add income.',
            actions: [
              { tool: 'create_account', reason: 'new USD account', input: { name: 'Vietnam', type: null, currency: 'USD', initialBalance: null } },
              { tool: 'create_transaction', reason: 'initial top-up', input: { kind: 'income', amount: '10k', currency: 'USD', account: 'Vietnam', category: null, section: null, description: 'top up' } },
            ],
          },
        },
      ],
    });

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system,
      prompt,
      schema: plannerSchema as unknown as Record<string, unknown>,
      temperature: 0,
      timeoutMs: 180_000,
    });

    return this.normalizePlan(raw);
  }

  private normalizePlan(raw: Record<string, unknown>): AIPlan {
    const mode = raw.mode;

    if (mode === 'actions') {
      const rawActions: unknown[] = Array.isArray(raw.actions)
        ? raw.actions
        : Array.isArray((raw as Record<string, unknown>).toolCalls)
          ? ((raw as Record<string, unknown>).toolCalls as unknown[])
          : [];

      const actionRecords = rawActions.filter(
        (item: unknown): item is Record<string, unknown> => (
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        ),
      );

      const actions = actionRecords
        .map((item: Record<string, unknown>) => {
          const input = this.asRecord(item.input) ?? this.asRecord(item.args) ?? {};

          return {
            tool: item.tool as any,
            input,
            reason: typeof item.reason === 'string' ? item.reason : undefined,
          };
        })
        .filter((action: { tool: unknown }) => typeof action.tool === 'string');

      if (actions.length === 0) {
        return {
          mode: 'clarification',
          language: typeof raw.language === 'string' ? raw.language : undefined,
          message: 'Я понял, что нужно действие, но не смог надёжно выделить его параметры. Скажи сумму, счёт или действие чуть конкретнее.',
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
        : 'Я могу помочь с финансами или подготовить действие в приложении.',
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }
}
