import { env } from '../../../config/env';
import { AIProvider } from './ai-provider.types';
import { OpenRouterProvider } from './openrouter.provider';

export function createAIProvider(): AIProvider {
  switch (env.aiProvider) {
    case 'openrouter':
      return new OpenRouterProvider();

    default:
      throw new Error(`Unsupported AI_PROVIDER: ${env.aiProvider}. Use AI_PROVIDER=openrouter.`);
  }
}
