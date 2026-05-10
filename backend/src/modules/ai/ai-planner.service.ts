import { AIPlan } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { AI_TOOL_REGISTRY } from './tools/tool-registry';

const plannerSchema = {
  type: 'object',
  additionalProperties: false,
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
        additionalProperties: false,
        properties: {
          tool: { enum: AI_TOOL_REGISTRY.map((tool) => tool.name) },
          reason: { type: ['string', 'null'] },
          input: { type: 'object' },
        },
        required: ['tool', 'input', 'reason'],
      },
    },
  },
  required: ['mode', 'language', 'summary', 'answer', 'message', 'missing', 'actions'],
} as const;

export class AIPlannerService {
  private readonly provider = new OllamaProvider();

  async plan(command: string, context: unknown): Promise<AIPlan> {
    const system = [
      'You are the semantic planner for an AI-first personal finance app.',
      'Your only job is to understand the user meaning and return structured JSON that matches the schema.',
      'Do not execute anything. Do not explain outside JSON.',
      'If the user asks to change app data, mode must be actions.',
      'If the user asks a finance question without requesting app changes, mode may be question.',
      'If required data is missing and cannot be inferred from context, mode must be clarification.',
      'One user message may contain many actions. Preserve order.',
      'Use the current accounts/categories/sections context to resolve references like there/it/that account.',
      'Important semantics:',
      '- depositing, adding, topping up, putting money onto an account is create_transaction kind income.',
      '- buying, spending, paying is create_transaction kind expense.',
      '- moving money between two accounts is transfer_money.',
      '- account name is the human label, not the whole sentence.',
      '- account currency is separate from account name; if user says account named “Dollars”, it can be a name unless they clearly mean USD currency.',
      '- support Russian, English, Vietnamese, and mixed language.',
    ].join('\n');

    const prompt = JSON.stringify({
      userText: command,
      availableTools: AI_TOOL_REGISTRY.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input: tool.input,
      })),
      currentContext: context,
      outputContract: {
        actionsMode: { mode: 'actions', actions: [{ tool: 'create_account', input: {} }] },
        questionMode: { mode: 'question', answer: 'short useful answer' },
        clarificationMode: { mode: 'clarification', message: 'what to clarify', missing: ['field'] },
      },
    });

    const raw = await this.provider.generateJson<Record<string, unknown>>({
      system,
      prompt,
      schema: plannerSchema as unknown as Record<string, unknown>,
      temperature: 0.05,
    });

    return this.normalizePlan(raw);
  }

  private normalizePlan(raw: Record<string, unknown>): AIPlan {
    const mode = raw.mode;

    if (mode === 'actions') {
      const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
      return {
        mode: 'actions',
        language: typeof raw.language === 'string' ? raw.language : undefined,
        summary: typeof raw.summary === 'string' ? raw.summary : undefined,
        actions: rawActions
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
          .map((item) => ({
            tool: item.tool as any,
            input: this.asRecord(item.input),
            reason: typeof item.reason === 'string' ? item.reason : undefined,
          })),
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
        : 'Я могу помочь с финансами или выполнить действие в приложении.',
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
