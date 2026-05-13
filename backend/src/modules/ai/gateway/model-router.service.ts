export type AIModelRole =
  | 'fast'
  | 'base';

export class ModelRouterService {
  getPlannerModel(): string {
    return process.env.OLLAMA_FAST_MODEL || 'qwen2.5:3b';
  }

  getConversationModel(): string {
    return process.env.OLLAMA_MODEL || 'qwen3:8b';
  }

  getKeepAlive(role: AIModelRole): string {
    switch (role) {
      case 'fast':
        return '1h';

      case 'base':
      default:
        return '20m';
    }
  }
}
