import { ProductEventsService } from '../analytics/product-events.service';
import { AIExecutorService } from './ai-executor.service';
import { AIMemoryService } from './ai-memory.service';
import { AIPreviewBuilder } from './ai-preview.builder';
import { AITrainingService } from './ai-training.service';
import { AIContextService } from './ai-context.service';
import { AIAdviceService } from './ai-advice.service';
import { AIRepeatService } from './ai-repeat.service';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIActionPolicy } from './policy';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';

export class AIManager {
  private readonly interpreter = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();
  private readonly memory = new AIMemoryService();
  private readonly training = new AITrainingService();
  private readonly events = new ProductEventsService();
  private readonly preview = new AIPreviewBuilder();
  private readonly executor = new AIExecutorService();
  private readonly context = new AIContextService();
  private readonly advice = new AIAdviceService();
  private readonly repeat = new AIRepeatService();

  async executeParsed(userId: string, command: string, parsedCommand: AIParsedCommand): Promise<AIResult> {
    const startedAt = Date.now();
    const policy = this.policy.evaluate(parsedCommand);
    const result = await this.executor.execute(userId, parsedCommand, policy.riskLevel);
    await this.logSuccess(userId, command, result, startedAt);
    return result;
  }

  async handle(userId: string, command: string, options?: AIHandleOptions): Promise<AIResult> {
    const startedAt = Date.now();

    try {
      const execute = options?.execute ?? true;
      const confirmed = options?.confirmed ?? false;

      await this.trackCommandReceived(userId, command);
      await this.memory.saveMessage({ userId, role: 'user', content: command });

      const adviceLikeResult = this.advice.tryBuildAdviceResult(command);
      if (adviceLikeResult) {
        await this.logSuccess(userId, command, adviceLikeResult, startedAt);
        return adviceLikeResult;
      }

      const repeatCommand = this.repeat.parseRepeatCommand(command);
      if (repeatCommand.isRepeat) {
        const repeatResult = await this.repeat.repeatLastTransaction(userId, repeatCommand.amount);
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      const history = await this.memory.getRecentMessages(userId, 6);
      const parsedCommand = await this.interpreter.parse(command, history);

      if (parsedCommand.intent === 'advice') {
        const adviceResult = this.advice.buildAdviceResult(parsedCommand.question || command);
        await this.logSuccess(userId, command, adviceResult, startedAt);
        return adviceResult;
      }

      if (parsedCommand.intent === 'unknown') {
        const unknownResult = this.advice.buildClarificationResult(command);
        await this.logSuccess(userId, command, unknownResult, startedAt);
        return unknownResult;
      }

      if (parsedCommand.intent === 'repeat_last') {
        const repeatResult = await this.repeat.repeatLastTransaction(userId);
        await this.logSuccess(userId, command, repeatResult, startedAt);
        return repeatResult;
      }

      await this.context.applyContextFallback(parsedCommand, history);

      const policy = this.policy.evaluate(parsedCommand);

      if (!execute || (policy.requiresConfirmation && !confirmed)) {
        const previewResult = await this.preview.buildPreview(
          userId,
          parsedCommand,
          policy.requiresConfirmation,
          policy.riskLevel,
          policy.reason,
        );

        await this.logSuccess(userId, command, previewResult, startedAt);
        return previewResult;
      }

      const result = await this.executor.execute(userId, parsedCommand, policy.riskLevel);
      await this.logSuccess(userId, command, result, startedAt);
      return result;
    } catch (error) {
      await this.logFailure(userId, command, error, startedAt);
      throw error;
    }
  }

  private async trackCommandReceived(userId: string, command: string) {
    await this.events.track({
      userId,
      event: 'ai_command_received',
      data: { commandLength: command.length },
    });
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

  private async logFailure(userId: string, command: string, error: unknown, startedAt: number) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';

    await this.training.save({
      userId,
      input: command,
      success: false,
      error: errorMessage,
      model: process.env.OLLAMA_MODEL,
      latencyMs: Date.now() - startedAt,
    });

    await this.events.track({
      userId,
      event: 'ai_command_error',
      data: {
        error: errorMessage,
        latencyMs: Date.now() - startedAt,
      },
    });
  }
}
