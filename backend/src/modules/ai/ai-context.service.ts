import { AIParsedCommand } from './types';
import { AIRepeatService } from './ai-repeat.service';

const repeatService = new AIRepeatService();

type MemoryMessage = {
  role?: string;
  meta?: unknown;
};

export class AIContextService {
  async applyContextFallback(parsedCommand: AIParsedCommand, history: MemoryMessage[]) {
    if (parsedCommand.intent !== 'expense' && parsedCommand.intent !== 'income') return;

    const currentCategory = String(parsedCommand.rawCategory ?? '').trim().toLowerCase();
    const shouldUsePreviousCategory =
      !currentCategory ||
      repeatService.isRepeatLikeText(currentCategory) ||
      currentCategory === 'расход' ||
      currentCategory === 'доход';

    if (!shouldUsePreviousCategory) return;

    const previousAssistantMessages = [...history]
      .reverse()
      .filter((message) => message.role === 'assistant');

    for (const message of previousAssistantMessages) {
      const parsed = this.readParsedFromMemory(message);

      if (
        parsed &&
        parsed.type === parsedCommand.intent &&
        typeof parsed.categoryName === 'string' &&
        parsed.categoryName.trim()
      ) {
        parsedCommand.rawCategory = parsed.categoryName;

        if (!parsedCommand.description || repeatService.isRepeatLikeText(String(parsedCommand.description))) {
          parsedCommand.description = parsed.categoryName;
        }

        return;
      }
    }
  }

  private readParsedFromMemory(message: MemoryMessage): Record<string, any> | null {
    try {
      const meta = typeof message.meta === 'string' ? JSON.parse(message.meta) : message.meta;
      const parsed = (meta as any)?.parsed;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}
