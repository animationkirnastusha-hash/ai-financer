import { env } from '../../config/env';
import { BadRequestError } from '../../shared/core/errors';
import type { AIParsedCommand } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { normalizeAmount } from './utils/amount-normalizer';
import { repairParsedCommand } from './utils/command-compiler';
import { buildToolRegistryPrompt } from './tools/tool-registry';
import { normalizeToolPlanToParsedCommand } from './tools/tool-plan-normalizer';

const SYSTEM_PROMPT = `
Ты AI-ядро финансового Telegram Mini App AI-financer.

Ты не парсер команд. Ты reasoning layer.
Твоя задача — понять цель пользователя и собрать capability plan для backend.
Пользователь не должен подбирать фразы.

Верни строго JSON. Без markdown. Без текста вокруг JSON. Без <think>.

${buildToolRegistryPrompt()}
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
  const enrichedInput = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>), originalText, userMessage: (input as Record<string, unknown>).userMessage ?? originalText }
    : input;

  const toolPlan = normalizeToolPlanToParsedCommand(enrichedInput);
  if (toolPlan) return repairParsedCommand(toolPlan, originalText);

  if (!input || typeof input !== 'object') return { intent: 'unknown', reason: 'invalid_ai_response' };

  const data = input as Record<string, unknown>;
  const intent = asString(data.intent, 'unknown').toLowerCase();

  if (intent === 'batch') {
    const rawActions = Array.isArray(data.actions) ? data.actions : [];
    const actions = rawActions
      .map((item) => normalizeParsed(item, originalText))
      .filter((item): item is Exclude<AIParsedCommand, { intent: 'batch' }> => item.intent !== 'batch' && item.intent !== 'unknown' && item.intent !== 'help');

    if (actions.length === 0) return { intent: 'unknown', reason: 'empty_batch' };
    if (actions.length === 1) return actions[0];

    return repairParsedCommand({
      intent: 'batch',
      actions,
      originalText,
      premiumSuggestion: data.premiumSuggestion ? asString(data.premiumSuggestion) : undefined,
    }, originalText);
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
      toAccountName: asString(data.toAccountName || data.accountName),
      description: data.description ? asString(data.description) : undefined,
    }, originalText);
  }

  if (intent === 'show_accounts') return { intent: 'show_accounts' };
  if (intent === 'repeat_last') return { intent: 'repeat_last' };

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
    return repairParsedCommand({
      intent: 'create_account',
      name: asString(data.name || data.accountName, 'Новый счёт'),
      type: asString(data.type, 'cash') as any,
      currency: asString(data.currency, 'RUB').toUpperCase() as any,
      balance: (normalizeAmount(data.balance) ?? Number(data.balance)) || 0,
    }, originalText);
  }

  if (intent === 'update_account') {
    return repairParsedCommand({
      intent: 'update_account',
      accountName: asString(data.accountName || data.name || data.currentName),
      name: data.newName || data.targetName ? asString(data.newName || data.targetName) : undefined,
      type: data.type ? asString(data.type) as any : undefined,
      currency: data.currency ? asString(data.currency).toUpperCase() as any : undefined,
      balance: data.balance !== undefined ? (normalizeAmount(data.balance) ?? Number(data.balance)) || 0 : undefined,
      showInTotalBalance: typeof data.showInTotalBalance === 'boolean' ? data.showInTotalBalance : undefined,
    }, originalText);
  }

  if (intent === 'delete_account') {
    return repairParsedCommand({ intent: 'delete_account', accountName: asString(data.accountName || data.name) }, originalText);
  }

  if (intent === 'delete_all_accounts') return { intent: 'delete_all_accounts', confirmScope: 'accounts' };
  if (intent === 'clear_history') {
    const scope = asString(data.scope, 'transactions').toLowerCase();
    return { intent: 'clear_history', scope: scope === 'ai' || scope === 'all' ? scope : 'transactions' };
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
  return { intent: 'unknown', reason: asString(data.reason, 'unknown_intent') };
}

export class LLMCommandInterpreter {
  private readonly ollama = new OllamaProvider();

  private pickModel(command: string) {
    const normalized = command.toLowerCase();
    const isComplex =
      normalized.includes(' и ') ||
      normalized.includes(' потом ') ||
      normalized.includes(' затем ') ||
      normalized.includes(';') ||
      normalized.includes('очист') ||
      normalized.includes('удали') ||
      normalized.includes('перев') ||
      normalized.includes('transfer') ||
      normalized.includes('delete') ||
      normalized.includes('clear');

    return isComplex ? env.ollamaFreeReasoningModel : env.ollamaFastModel;
  }

  async parse(command: string, history: Array<{ role: string; content: string }> = []): Promise<AIParsedCommand> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('Command is required');

    if (env.aiMode !== 'ollama') {
      return { intent: 'unknown', reason: 'ollama_disabled' };
    }

    try {
      const response = await this.ollama.complete({
        model: this.pickModel(trimmed),
        temperature: 0.03,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT +
              `\n\nRECENT DIALOG CONTEXT:\n${history.map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`).join('\n')}\n\nContext rules:\n- Resolve pronouns/references like "туда", "на него", "there" from the current request first, then recent dialog.\n- If a goal is executable by available capabilities, return toolCalls.\n- If required data is missing, return toolCalls: [] with userMessage.\n`,
          },
          { role: 'user', content: trimmed },
        ],
      });

      return normalizeParsed(extractJsonObject(response.content), trimmed);
    } catch (error) {
      console.error('Ollama reasoning failed:', error);
      return {
        intent: 'advice',
        question: 'AI сейчас не смог собрать безопасный план действий. Попробуй повторить фразу короче или проверь Ollama.',
      };
    }
  }
}
