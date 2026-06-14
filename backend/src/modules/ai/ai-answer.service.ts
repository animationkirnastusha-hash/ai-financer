import { createAIProvider } from './providers/ai-provider.factory';
import { AIModelRole } from './providers/ai-provider.types';
import { buildFinanceReplyFallback, cleanAssistantReply } from './messages/ai-reply-fallbacks';

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
  private readonly provider = createAIProvider();

  async answer(command: string, context: unknown, modelRole: AIModelRole, preplannedAnswer?: string): Promise<string> {
    if (preplannedAnswer && preplannedAnswer.trim().length > 8) {
      return preplannedAnswer.trim();
    }

    const system = [
      'You are Fina, a concise AI companion inside a personal finance app.',
      'Answer naturally and meaningfully, not as a fixed template. No chain-of-thought. Use the user language.',
      'If the user says something off-topic, answer the meaning of their words in 1-2 short sentences, then gently return to financial context only if natural.',
      'Do not claim to remember non-financial personal facts. Long-term memory is finance-only.',
      'If the request requires changing app data, explain what data is missing or what should be checked, without pretending that the action was saved.',
      'Return JSON only: {"answer":"..."}.',
    ].join(' ');

    const prompt = [
      'Context:',
      JSON.stringify(this.compactContext(context)),
      'User:',
      command,
    ].join('\n');

    const raw = await this.provider.generateJson<AnswerResponse>({
      system,
      prompt,
      modelRole,
      temperature: 0.2,
      timeoutMs: modelRole === 'premium' ? 45_000 : 12_000,
      numPredict: modelRole === 'premium' ? 700 : 300,
    });

    const answer = cleanAssistantReply(raw.answer);
    return answer || buildFinanceReplyFallback();
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 8).map((account) => ({ name: account.name, currency: account.currency, balance: account.balance }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 12).map((category) => ({ name: category.name, type: category.type }))
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 8).map((section) => section.name).filter(Boolean)
        : [],
      recentTransactions: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.slice(0, 5).map((transaction) => ({
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
