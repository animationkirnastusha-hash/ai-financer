import { AIResult } from './types';

export class AIResponseNormalizerService {
  normalize(result: AIResult): AIResult {
    return {
      success: Boolean(result.success),
      intent: typeof result.intent === 'string' ? result.intent : 'unknown',
      executed: Boolean(result.executed),
      requiresConfirmation: Boolean(result.requiresConfirmation),
      riskLevel: this.risk(result.riskLevel),
      message: typeof result.message === 'string' ? result.message : '',
      parsed: result.parsed && typeof result.parsed === 'object' && !Array.isArray(result.parsed)
        ? result.parsed
        : null,
      result: result.result ?? null,
      meta: {
        ...(result.meta ?? {}),
      },
    };
  }

  private risk(value: unknown): 'low' | 'medium' | 'high' {
    return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
  }
}

export const aiResponseNormalizer = new AIResponseNormalizerService();
