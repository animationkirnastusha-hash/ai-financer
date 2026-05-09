import { AIActionPolicy } from './policy';
import { LLMCommandInterpreter } from './llm-command-interpreter';
import { AIHandleOptions, AIParsedCommand, AIResult } from './types';
import { AIPreviewBuilder } from './ai-preview.builder';
import { AIExecutorService } from './ai-executor.service';
import { AIAdviceService } from './ai-advice.service';
import { AIRepeatService } from './ai-repeat.service';
import { AIContextService } from './ai-context.service';

export class AIPipelineService {
  private readonly parser = new LLMCommandInterpreter();
  private readonly policy = new AIActionPolicy();
  private readonly preview = new AIPreviewBuilder();
  private readonly executor = new AIExecutorService();
  private readonly advice = new AIAdviceService();
  private readonly repeat = new AIRepeatService();
  private readonly context = new AIContextService();

  async executeParsed(userId: string, parsedCommand: AIParsedCommand): Promise<AIResult> {
    const policy = this.policy.evaluate(parsedCommand);
    return this.executor.execute(userId, parsedCommand, policy.riskLevel);
  }

  async handle(userId: string, command: string, history: Array<any>, options?: AIHandleOptions): Promise<AIResult> {
    const execute = options?.execute ?? true;
    const confirmed = options?.confirmed ?? false;

    const adviceLikeResult = this.advice.tryBuildAdviceResult(command);
    if (adviceLikeResult) return adviceLikeResult;

    const repeatCommand = this.repeat.parseRepeatCommand(command);
    if (repeatCommand.isRepeat) {
      return this.repeat.repeatLastTransaction(userId, repeatCommand.amount);
    }

    const parsedCommand = await this.parser.parse(command, history);

    if (parsedCommand.intent === 'advice') {
      return this.advice.buildAdviceResult(parsedCommand.question || command);
    }

    if (parsedCommand.intent === 'unknown') {
      return this.advice.buildClarificationResult(command);
    }

    if (parsedCommand.intent === 'repeat_last') {
      return this.repeat.repeatLastTransaction(userId);
    }

    await this.context.applyContextFallback(parsedCommand, history);

    const policy = this.policy.evaluate(parsedCommand);

    if (!execute || (policy.requiresConfirmation && !confirmed)) {
      return this.preview.buildPreview(
        userId,
        parsedCommand,
        policy.requiresConfirmation,
        policy.riskLevel,
        policy.reason,
      );
    }

    return this.executor.execute(userId, parsedCommand, policy.riskLevel);
  }
}
