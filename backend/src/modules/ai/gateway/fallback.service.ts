export class FallbackService {
  getFallbackModels(): string[] {
    return [
      process.env.OLLAMA_MODEL || 'qwen3:8b',
      process.env.OLLAMA_FAST_MODEL || 'qwen2.5:3b'
    ];
  }
}
