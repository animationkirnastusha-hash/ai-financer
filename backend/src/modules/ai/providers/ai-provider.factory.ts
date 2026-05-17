import { env } from '../../../config/env';
import { AIProvider } from './ai-provider.types';
import { DeepSeekProvider } from './deepseek.provider';

let instance: AIProvider | null = null;

export function createAIProvider(): AIProvider {
  if (instance) return instance;

  switch (env.aiProvider) {
    case 'deepseek':
      instance = new DeepSeekProvider();
      return instance;

    default:
      throw new Error(`Unsupported AI_PROVIDER: ${env.aiProvider}. Use AI_PROVIDER=deepseek.`);
  }
}
