import { AIProvider, AIProviderJsonRequest } from '../providers/ai-provider.types';

export class FakeAIProvider implements AIProvider {
  public requests: AIProviderJsonRequest[] = [];

  constructor(private readonly responses: Array<Record<string, unknown>>) {}

  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error('FakeAIProvider has no queued response');
    return next as T;
  }
}
