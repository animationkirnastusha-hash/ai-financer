export class WarmupService {
  async warmup(): Promise<void> {
    // Remote providers such as DeepSeek do not need local model warmup.
  }

  startHeartbeat(): void {
    // Disabled intentionally. No Ollama/model preload in DeepSeek mode.
  }
}
