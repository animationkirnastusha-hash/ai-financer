import { env } from '../../../config/env';
import { AIProvider } from './ai-provider.types';
import { DeepSeekProvider } from './deepseek.provider';


export function createAIProvider(): AIProvider {
  switch (env.aiProvider) {
    case 'deepseek':
      return new DeepSeekProvider();

    default:
      throw new Error(`Unsupported AI_PROVIDER: ${env.aiProvider}`);
  }
}
