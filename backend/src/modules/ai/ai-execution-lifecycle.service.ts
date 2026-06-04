import { aiSessionService } from './ai-session.service';
import { AIMemoryService } from './ai-memory.service';
import { AIParsedCommand } from './types';

export class AIExecutionLifecycleService {
  private readonly memory = new AIMemoryService();

  async rememberSuccessfulExecution(userId: string, command: string, parsed: AIParsedCommand, result: unknown) {
    await aiSessionService.clear(userId);
    await aiSessionService.rememberResult(userId, { command, intent: parsed.intent, tool: parsed.actions[0]?.tool, result });
    await this.memory.rememberFinancialResult(userId, { command, intent: parsed.intent, tools: parsed.actions.map((action) => action.tool), result });
  }
}
