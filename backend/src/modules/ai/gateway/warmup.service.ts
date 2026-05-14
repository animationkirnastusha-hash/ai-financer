export class WarmupService {
  async warmup(): Promise<void> {
    // Remote AI providers do not need local model warmup.
  }

  startHeartbeat(): void {
    // Disabled. Warmup was only needed for local Ollama models.
  }
}
