import { AIHandleOptions, AIParsedCommand, AIResult } from './types';
import { AIMemoryService } from './ai-memory.service';
import { AITrainingService } from './ai-training.service';
import { ProductEventsService } from '../analytics/product-events.service';
import { AIPipelineService } from './ai-pipeline.service';

export class AIManager {
  private readonly memory = new AIMemoryService();
  private readonly training = new AITrainingService();
  private readonly events = new ProductEventsService();
  private readonly pipeline = new AIPipelineService();

  async executeParsed(userId: string, command: string, parsedCommand: AIParsedCommand): Promise<AIResult> {
    const startedAt = Date.now();
    const result = await this.pipeline.executeParsed(userId, parsedCommand);
    await this.logSuccess(userId, command, result, startedAt);
    return result;
  }

  async handle(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    const startedAt = Date.now();

    try {
      await this.events.track({
        userId,
        event: 'ai_command_received',
        data: { commandLength: command.length },
      });

      await this.memory.saveMessage({ userId, role: 'user', content: command });

      const history = await this.memory.getRecentMessages(userId, 6);
      const result = await this.pipeline.handle(userId, command, history, options);

      await this.logSuccess(userId, command, result, startedAt);
      return result;
    } catch (error) {
      await this.training.save({
        userId,
        input: command,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AI error',
        model: process.env.OLLAMA_MODEL,
        latencyMs: Date.now() - startedAt,
      });

      await this.events.track({
        userId,
        event: 'ai_command_error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown AI error',
          latencyMs: Date.now() - startedAt,
        },
      });

      throw error;
    }
  }

  private async logSuccess(userId: string, command: string, result: AIResult, startedAt: number) {
    await this.memory.saveMessage({
      userId,
      role: 'assistant',
      content: result.message,
      meta: {
        intent: result.intent,
        executed: result.executed,
        requiresConfirmation: result.requiresConfirmation,
        parsed: result.parsed,
      },
    });

    await this.training.save({
      userId,
      input: command,
      aiOutput: result.parsed,
      success: result.success,
      model: process.env.OLLAMA_MODEL,
      latencyMs: Date.now() - startedAt,
    });

    await this.events.track({
      userId,
      event: result.success ? 'ai_command_success' : 'ai_command_failed',
      data: {
        intent: result.intent,
        executed: result.executed,
        requiresConfirmation: result.requiresConfirmation,
        latencyMs: Date.now() - startedAt,
      },
    });
  }
}
