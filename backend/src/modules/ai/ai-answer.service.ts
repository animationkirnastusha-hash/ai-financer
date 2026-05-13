import { OllamaProvider } from './providers/ollama.provider';
import { AIModelRole } from './providers/ai-provider.types';

type UserContext = {
  accounts?: Array<{ name?: string; type?: string; currency?: string; balance?: number }>;
  categories?: Array<{ name?: string; type?: string }>;
  sections?: Array<{ name?: string }>;
  recentTransactions?: Array<{ type?: string; amount?: number; description?: string; createdAt?: unknown }>;
};

type AnswerResponse = {
  answer?: string;
};

export class AIAnswerService {
  private readonly provider = new OllamaProvider();

  async answer(command: string, context: unknown, modelRole: AIModelRole): Promise<string> {
    const system = [
      'You are a concise financial assistant inside a personal finance app.',
      'Answer the user directly when no app action is required or when the user asks for explanation, analysis, advice, or help.',
      'If the request requires changing app data, do not pretend it was done. Say that the action must be prepared and confirmed.',
      'Use the user language. Prefer Russian unless the user clearly uses another language.',
      'Return JSON only: {"answer":"..."}.',
    ].join(' ');

    const prompt = [
      'Current app context:',
      JSON.stringify(this.compactContext(context)),
      'User text:',
      command,
    ].join('\n');

    const raw = await this.provider.generateJson<AnswerResponse>({
      system,
      prompt,
      modelRole,
      temperature: 0.2,
      timeoutMs: modelRole === 'premium' ? 120_000 : 60_000,
      numCtx: modelRole === 'premium' ? 2048 : 1536,
      numPredict: modelRole === 'premium' ? 260 : 180,
    });

    const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
    return answer || 'Я могу ответить на финансовый вопрос или подготовить действие в приложении.';
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 12).map((account) => ({
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 20).map((category) => ({ name: category.name, type: category.type }))
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 12).map((section) => section.name).filter(Boolean)
        : [],
      recentTransactions: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.slice(0, 8).map((transaction) => ({
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt,
        }))
        : [],
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
