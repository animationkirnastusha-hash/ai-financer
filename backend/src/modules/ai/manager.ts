import { AIActionPolicy } from './policy';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIHandleOptions, AIResult } from './types';
import { AIMemoryService } from './ai-memory.service';
import { AITrainingService } from './ai-training.service';
import { ProductEventsService } from '../analytics/product-events.service';
import { AIPreviewBuilder } from './ai-preview.builder';
import { AIExecutorService } from './ai-executor.service';

export class AIManager {
  private readonly parser = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();
  private readonly memory = new AIMemoryService();
  private readonly training = new AITrainingService();
  private readonly events = new ProductEventsService();
  private readonly preview = new AIPreviewBuilder();
  private readonly executor = new AIExecutorService();

  async handle(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    const startedAt = Date.now();

    try {
      const execute = options?.execute ?? true;
      const confirmed = options?.confirmed ?? false;

      await this.events.track({
        userId,
        event: 'ai_command_received',
        data: {
          commandLength: command.length,
        },
      });

      await this.memory.saveMessage({
        userId,
        role: 'user',
        content: command,
      });

      const parsedCommand = await this.parser.parse(command);
      const policy = this.policy.evaluate(parsedCommand);

      if (!execute || (policy.requiresConfirmation && !confirmed)) {
        const previewResult = await this.preview.buildPreview(
          userId,
          parsedCommand,
          policy.requiresConfirmation,
          policy.riskLevel,
          policy.reason
        );

        await this.logSuccess(userId, command, previewResult, startedAt);

        return previewResult;
      }

      const result = await this.executor.execute(userId, parsedCommand, policy.riskLevel);

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