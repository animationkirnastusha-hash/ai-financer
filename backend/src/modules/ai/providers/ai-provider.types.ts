export interface AIProviderJsonRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  generateJson<T>(request: AIProviderJsonRequest): Promise<T>;
}
