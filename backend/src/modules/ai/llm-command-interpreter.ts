import { env } from '../../config/env';
import { BadRequestError } from '../../shared/core/errors';
import type { AIParsedCommand } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { buildToolRegistryPrompt } from './tools/tool-registry';
import { normalizeToolPlanToParsedCommand } from './tools/tool-plan-normalizer';

const SYSTEM_PROMPT = `
Ты AI-ядро финансового Telegram Mini App AI-financer.

Ты не parser и не набор regex-команд.
Ты semantic planner: понимаешь человеческий запрос, контекст и возвращаешь JSON tool plan.
Backend потом валидирует, показывает preview/confirm и исполняет.

Запрещено возвращать старую схему intent.
Разрешён только формат toolCalls.

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

export class LLMCommandInterpreter {
  private readonly ollama = new OllamaProvider();

  private pickModel(command: string) {
    const normalized = command.toLowerCase();
    const isComplex =
      normalized.includes(' и ') ||
      normalized.includes(' потом ') ||
      normalized.includes(' затем ') ||
      normalized.includes(';') ||
      normalized.length > 90;

    return isComplex ? env.ollamaFreeReasoningModel : env.ollamaFastModel;
  }

  async parse(command: string, history: Array<{ role: string; content: string }> = []): Promise<AIParsedCommand> {
    const trimmed = command.trim();
    if (!trimmed) throw new BadRequestError('Command is required');

    if (env.aiMode !== 'ollama') {
      return { intent: 'advice', question: 'AI-режим Ollama выключен. Включи Ollama, чтобы я мог выполнять действия.' };
    }

    try {
      const recentContext = history
        .slice(-10)
        .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
        .join('\n');

      const response = await this.ollama.complete({
        model: this.pickModel(trimmed),
        temperature: 0.05,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT +
              `\n\nRECENT DIALOG CONTEXT:\n${recentContext}\n\nContext rules:\n- Resolve pronouns/references like "туда", "на него", "there" from the current request first, then recent dialog.\n- If the user's goal is executable by available tools, return toolCalls.\n- If required data is missing, return toolCalls: [] and userMessage.\n- Never output explanations outside JSON.\n`,
          },
          { role: 'user', content: trimmed },
        ],
      });

      const parsed = normalizeToolPlanToParsedCommand(extractJsonObject(response.content));
      return parsed ?? { intent: 'advice', question: 'Я понял текст, но модель вернула неверный формат плана. Повтори запрос короче.' };
    } catch (error) {
      console.error('Ollama semantic planning failed:', error);
      return {
        intent: 'advice',
        question: 'AI сейчас не смог собрать безопасный план действий. Проверь Ollama или повтори запрос короче.',
      };
    }
  }
}
