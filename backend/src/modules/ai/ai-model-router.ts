import { prisma } from '../../lib/prisma';
import { AIModelRole } from './providers/ai-provider.types';

export type AIUserTier = 'FREE' | 'PREMIUM' | 'BUSINESS' | string;

export class AIModelRouter {
  async getUserTier(userId: string): Promise<AIUserTier> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    return user?.tier || 'FREE';
  }

  roleForPlanner(): AIModelRole {
    return 'fast';
  }

  roleForAnswer(tier: AIUserTier): AIModelRole {
    return this.isPremiumLike(tier) ? 'premium' : 'base';
  }

  roleForFinancialReasoning(tier: AIUserTier): AIModelRole {
    return this.isPremiumLike(tier) ? 'premium' : 'base';
  }

  isPremium(tier: AIUserTier) {
    return String(tier).toUpperCase() === 'PREMIUM';
  }

  isBusiness(tier: AIUserTier) {
    return String(tier).toUpperCase() === 'BUSINESS';
  }

  isPremiumLike(tier: AIUserTier) {
    return this.isPremium(tier) || this.isBusiness(tier);
  }
}
