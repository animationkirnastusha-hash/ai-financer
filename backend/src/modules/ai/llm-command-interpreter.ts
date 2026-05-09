import { env } from '../../config/env';
import { BadRequestError } from '../../shared/core/errors';
import type { AIParsedCommand } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { normalizeAmount } from './utils/amount-normalizer';
import { compileNaturalBatch, repairParsedCommand } from './utils/command-compiler';
import { buildToolRegistryPrompt } from './tools/tool-registry';
import { normalizeToolPlanToParsedCommand } from './tools/tool-plan-normalizer';

const SYSTEM_PROMPT = `
Ты AI-ядро финансового Telegram Mini App AI-financer.

Главное правило:
Пользователь не должен подбирать команды. Он может писать разговорно, с ошибками, сленгом, смешивать доходы, расходы, счета, переводы, категории, разделы и настройки в одном сообщении.

Ты должен понять смысл и вернуть строго JSON для backend.
Никакого markdown, текста до/после JSON, комментариев, <think> или code block.

${buildToolRegistryPrompt()}

Предпочтительный формат — toolCalls.
Legacy intents можно вернуть только если toolCalls неудобны:
- batch
- expense
- income
- transfer
- show_accounts
- create_category
- create_section
- assign_expenses_to_section
- create_account
- stats
- financial_planning
- advice
- repeat_last
- help
- unknown
`;

function stripThinkingBlocks(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonObject(value: string) {
  const cleaned = stripThinkingBlocks(value);

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No JSON object found in AI response');
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
  }
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asPositiveNumber(value: unknown) {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return normalized;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('Invalid amount from AI');
  return amount;
}

function normalizeParsed(input: unknown, originalText = ''): AIParsedCommand {
  const enrichedInput = input && typeof input === 'object' && !Array.isArray(input) && originalText
    ? { ...(input as Record<string, unknown>), originalText, userMessage: originalText }
    : input;

  const toolPlan = normalizeToolPlanToParsedCommand(enrichedInput);
  if (toolPlan) return repairParsedCommand(toolPlan, originalText);

  if (!input || typeof input !== 'object') return { intent: 'unknown' };

  const data = input as Record<string, unknown>;
  const intent = asString(data.intent, 'unknown').toLowerCase();

  if (intent === 'batch') {
    const sourceText = asString(data.originalText || data.original || data.command, originalText);
    const rawActions = Array.isArray(data.actions) ? data.actions : [];
    const actions = rawActions
      .map((item) => normalizeParsed(item, sourceText))
      .filter((item): item is Exclude<AIParsedCommand, { intent: 'batch' }> => {
        return item.intent !== 'batch' && item.intent !== 'unknown' && item.intent !== 'help';
      });

    if (actions.length === 0) return { intent: 'unknown' };
    if (actions.length === 1) return actions[0];

    return repairParsedCommand({
      intent: 'batch',
      actions,
      originalText: sourceText,
      premiumSuggestion: data.premiumSuggestion ? asString(data.premiumSuggestion) : undefined,
    }, sourceText);
  }

  if (intent === 'expense' || intent === 'income') {
    const rawCategory = asString(data.rawCategory || data.category || data.description, intent === 'income' ? 'доход' : 'расход');

    return repairParsedCommand({
      intent,
      amount: asPositiveNumber(data.amount),
      currency: data.currency ? asString(data.currency).toUpperCase() : undefined,
      rawCategory,
      description: asString(data.description, rawCategory),
      accountName: data.accountName ? asString(data.accountName) : undefined,
      sectionName: data.sectionName ? asString(data.sectionName) : undefined,
    }, originalText);
  }

  if (intent === 'transfer') {
    return repairParsedCommand({
      intent: 'transfer',
      amount: asPositiveNumber(data.amount),
      fromAccountName: data.fromAccountName ? asString(data.fromAccountName) : undefined,
      toAccountName: asString(data.toAccountName || data.accountName),
    }, originalText);
  }

  if (intent === 'show_accounts') return { intent: 'show_accounts' };
  if (intent === 'repeat_last') return { intent: 'repeat_last' };

  if (intent === 'stats') {
    return { intent: 'stats', type: data.type === 'income' ? 'income' : 'expense', rawCategory: data.rawCategory ? asString(data.rawCategory) : undefined };
  }

  if (intent === 'create_category') {
    return { intent: 'create_category', name: asString(data.name || data.rawCategory, 'Новая категория'), type: data.type === 'income' ? 'income' : 'expense', sectionName: data.sectionName ? asString(data.sectionName) : undefined };
  }

  if (intent === 'create_section') return { intent: 'create_section', name: asString(data.name || data.sectionName, 'Новый раздел') };

  if (intent === 'assign_expenses_to_section') {
    return { intent: 'assign_expenses_to_section', rawQuery: asString(data.rawQuery || data.category || data.description, ''), sectionName: asString(data.sectionName || data.name, 'Новый раздел') };
  }

  if (intent === 'create_account') {
    const type = asString(data.type, 'cash').toLowerCase();
    const currency = asString(data.currency, 'RUB').toUpperCase();

    return repairParsedCommand({
      intent: 'create_account',
      name: asString(data.name, 'Новый счёт'),
      type: ['cash', 'card', 'savings', 'investment'].includes(type) ? type : 'cash',
      currency: ['RUB', 'USD', 'EUR', 'VND'].includes(currency) ? currency : 'RUB',
      balance: (normalizeAmount(data.balance) ?? Number(data.balance)) || 0,
    }, originalText);
  }

  if (intent === 'advice') return { intent: 'advice', question: asString(data.question || data.description, '') };

  if (intent === 'financial_planning') {
    return {
      intent: 'financial_planning',
      monthlyIncome: data.monthlyIncome ? normalizeAmount(data.monthlyIncome) ?? Number(data.monthlyIncome) : undefined,
      monthlyExpenses: data.monthlyExpenses ? normalizeAmount(data.monthlyExpenses) ?? Number(data.monthlyExpenses) : undefined,
      targetAmount: data.targetAmount ? normalizeAmount(data.targetAmount) ?? Number(data.targetAmount) : undefined,
      targetDateText: data.targetDateText ? asString(data.targetDateText) : undefined,
      question: asString(data.question || data.description, ''),
    };
  }

  if (intent === 'help') return { intent: 'help' };
  return { intent: 'unknown' };
}

export class LLMCommandInterpreter {
  private readonly ollama = new OllamaProvider();

  private pickModel(command: string) {
    const normalized = command.toLowerCase();
    const isComplex =
      normalized.includes('финансов') ||
      normalized.includes('модель') ||
      normalized.includes('накоп') ||
      normalized.includes('скоп') ||
      normalized.includes('план') ||
      normalized.includes('цель') ||
      normalized.includes('прогноз') ||
      normalized.includes(' и ') ||
      normalized.includes(' потом ') ||
      normalized.includes(' затем ') ||
      normalized.includes(';');

    return isComplex ? env.ollamaFreeReasoningModel : env.ollamaFastModel;
  }

  async parse(command: string, history: Array<{ role: string; content: string }> = []): Promise<AIParsedCommand> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('Command is required');

    const semanticResult = compileNaturalBatch(trimmed);
    if (semanticResult) return repairParsedCommand(semanticResult, trimmed);

    if (env.aiMode !== 'ollama') return { intent: 'unknown' };

    try {
      const response = await this.ollama.complete({
        model: this.pickModel(trimmed),
        temperature: 0.08,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT +
              `\n\nDIALOG MEMORY:\n${history.map((message) => `${message.role === 'user' ? 'Пользователь' : 'AI'}: ${message.content}`).join('\n')}\n\nПравила памяти:\n- если пользователь просит повторить действие: repeat_last\n- если пользователь пишет «ещё 200» после «кофе 350», это новая операция той же категории с новой суммой\n- если пользователь пишет «туда/на него/на неё», используй последний явно созданный/упомянутый счёт из текущего запроса или истории\n- если данных не хватает, верни toolCalls: [] и короткий userMessage с уточнением\n`,
          },
          { role: 'user', content: trimmed },
        ],
      });

      return normalizeParsed(extractJsonObject(response.content), trimmed);
    } catch (error) {
      console.error('Ollama parse failed. Falling back to semantic compiler:', error);
      return compileNaturalBatch(trimmed) || { intent: 'unknown' };
    }
  }
}
