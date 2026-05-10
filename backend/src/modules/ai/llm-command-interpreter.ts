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

Ты не парсер команд. Ты reasoning layer: понимаешь цель пользователя и собираешь capability plan для backend.

Главное правило:
Пользователь не должен подбирать формулировки. Он может писать разговорно, с ошибками, сленгом, на русском/английском/вьетнамском, смешивать несколько целей в одном сообщении.

Верни строго JSON. Никакого markdown, текста до/после JSON, комментариев или <think>.

${buildToolRegistryPrompt()}

Если действия можно выполнить в базовой версии — верни toolCalls.
Если опасное действие явно запрошено — тоже верни toolCall, backend сам сделает confirmation.
Если критически не хватает данных — верни { "toolCalls": [], "userMessage": "короткое уточнение" }.
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
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error('No JSON object found in AI response');
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
  if (normalized !== null && normalized > 0) return Math.round(normalized);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('Invalid amount from AI');
  return Math.round(amount);
}

function normalizeLegacyParsed(input: unknown, originalText = ''): AIParsedCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { intent: 'unknown', reason: 'invalid_ai_json' };

  const data = input as Record<string, unknown>;
  const intent = asString(data.intent || data.type, 'unknown').toLowerCase();

  if (intent === 'batch') {
    const sourceText = asString(data.originalText || data.original || data.command, originalText);
    const rawActions = Array.isArray(data.actions) ? data.actions : [];
    const actions = rawActions
      .map((item) => normalizeParsed(item, sourceText))
      .filter((item): item is Exclude<AIParsedCommand, { intent: 'batch' }> => item.intent !== 'batch' && item.intent !== 'unknown' && item.intent !== 'help');

    if (actions.length === 0) return { intent: 'unknown', reason: 'empty_batch' };
    return repairParsedCommand(actions.length === 1 ? actions[0] : { intent: 'batch', actions, originalText: sourceText }, sourceText);
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
      currency: data.currency ? asString(data.currency).toUpperCase() : undefined,
      fromAccountName: data.fromAccountName ? asString(data.fromAccountName) : undefined,
      toAccountName: asString(data.toAccountName || data.accountName || data.to),
      description: data.description ? asString(data.description) : undefined,
    }, originalText);
  }

  if (intent === 'show_accounts') return { intent: 'show_accounts' };
  if (intent === 'repeat_last') return { intent: 'repeat_last' };
  if (intent === 'delete_all_accounts') return { intent: 'delete_all_accounts', scope: 'all' };
  if (intent === 'clear_history') return { intent: 'clear_history', scope: data.scope === 'audit' ? 'audit' : data.scope === 'all' ? 'all' : 'all_transactions' };

  if (intent === 'stats') {
    return { intent: 'stats', type: data.type === 'income' ? 'income' : 'expense', rawCategory: data.rawCategory ? asString(data.rawCategory) : undefined };
  }

  if (intent === 'create_category') {
    return repairParsedCommand({ intent: 'create_category', name: asString(data.name || data.rawCategory, 'Новая категория'), type: data.type === 'income' ? 'income' : 'expense', sectionName: data.sectionName ? asString(data.sectionName) : undefined }, originalText);
  }

  if (intent === 'create_section') return repairParsedCommand({ intent: 'create_section', name: asString(data.name || data.sectionName, 'Новый раздел') }, originalText);

  if (intent === 'assign_expenses_to_section') {
    return repairParsedCommand({ intent: 'assign_expenses_to_section', rawQuery: asString(data.rawQuery || data.category || data.description, ''), sectionName: asString(data.sectionName || data.name, 'Новый раздел') }, originalText);
  }

  if (intent === 'create_account') {
    const type = asString(data.type, 'cash').toLowerCase();
    const currency = asString(data.currency, 'RUB').toUpperCase();
    return repairParsedCommand({
      intent: 'create_account',
      name: asString(data.name, 'Новый счёт'),
      type: ['cash', 'card', 'savings', 'investment'].includes(type) ? type as any : 'cash',
      currency: ['RUB', 'USD', 'EUR', 'VND'].includes(currency) ? currency : 'RUB',
      balance: Math.round((normalizeAmount(data.balance) ?? Number(data.balance)) || 0),
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
  return { intent: 'unknown', reason: data.userMessage ? asString(data.userMessage) : 'unknown_intent' };
}

function normalizeParsed(input: unknown, originalText = ''): AIParsedCommand {
  const enrichedInput = input && typeof input === 'object' && !Array.isArray(input) && originalText
    ? { ...(input as Record<string, unknown>), originalText, userMessage: (input as Record<string, unknown>).userMessage ?? originalText }
    : input;

  const toolPlan = normalizeToolPlanToParsedCommand(enrichedInput);
  if (toolPlan) return repairParsedCommand(toolPlan, originalText);

  return normalizeLegacyParsed(input, originalText);
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
      normalized.includes(';') ||
      normalized.includes(',');

    return isComplex ? env.ollamaFreeReasoningModel : env.ollamaFastModel;
  }

  async parse(command: string, history: Array<{ role: string; content: string }> = []): Promise<AIParsedCommand> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('Command is required');

    if (env.aiMode !== 'ollama') return compileNaturalBatch(trimmed) || { intent: 'unknown', reason: 'ai_disabled' };

    try {
      const response = await this.ollama.complete({
        model: this.pickModel(trimmed),
        temperature: 0.05,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT +
              `\n\nDIALOG MEMORY:\n${history.map((message) => `${message.role === 'user' ? 'Пользователь' : 'AI'}: ${message.content}`).join('\n')}\n\nContext rules:\n- If user says "туда/there/to it", use the last explicitly mentioned account from the same request or recent dialog.\n- If user says "ещё", infer repeated context only when safe.\n- Return semantic names, not database ids.\n`,
          },
          { role: 'user', content: trimmed },
        ],
      });

      const parsed = normalizeParsed(extractJsonObject(response.content), trimmed);
      if (parsed.intent !== 'unknown') return parsed;

      return compileNaturalBatch(trimmed) || parsed;
    } catch (error) {
      console.error('Ollama reasoning failed. Falling back to safety compiler:', error);
      return compileNaturalBatch(trimmed) || { intent: 'unknown', reason: 'reasoning_failed' };
    }
  }
}
