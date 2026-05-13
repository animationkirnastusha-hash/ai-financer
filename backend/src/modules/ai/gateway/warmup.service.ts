import axios from 'axios';
import { ModelRouterService } from './model-router.service';

export class WarmupService {
  private readonly router = new ModelRouterService();

  async warmup(): Promise<void> {
    await this.warmModel(this.router.getPlannerModel(), '1h');
    await this.warmModel(this.router.getConversationModel(), '20m');
  }

  startHeartbeat(): void {
    setInterval(async () => {
      try {
        await this.warmup();
      } catch (error) {
        console.error('[AI Warmup Error]', error);
      }
    }, 1000 * 60 * 5);
  }

  private async warmModel(model: string, keepAlive: string): Promise<void> {
    const baseUrl =
      process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    await axios.post(`${baseUrl}/api/chat`, {
      model,
      think: false,
      keep_alive: keepAlive,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'Return only OK.'
        },
        {
          role: 'user',
          content: 'ping'
        }
      ],
      options: {
        temperature: 0,
        num_predict: 4,
        num_ctx: 128
      }
    });
  }
}
