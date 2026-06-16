import { prisma } from '../../lib/prisma';

const CAPABILITIES = [
  { key: 'basic_ai_control', tier: 'FREE', description: 'Natural-language finance control.' },
  { key: 'basic_voice', tier: 'FREE', description: 'Voice text goes through the same AI pipeline.' },
  { key: 'basic_analytics', tier: 'FREE', description: 'Basic spending/income questions.' },
  { key: 'companion_basic', tier: 'FREE', description: 'Basic companion reactions.' },
  { key: 'advanced_memory', tier: 'PREMIUM', description: 'Deeper long-term memory and preferences.' },
  { key: 'proactive_insights', tier: 'PREMIUM', description: 'Proactive financial insights.' },
  { key: 'advanced_automation', tier: 'PREMIUM', description: 'More automation rules and routines.' },
  { key: 'premium_companion', tier: 'PREMIUM', description: 'Custom companion behavior and tone depth.' },
  { key: 'deep_analytics', tier: 'PREMIUM', description: 'Forecasting and richer long-term analytics.' },
] as const;

export class AIPremiumService {
  async getCapabilities(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const tier = user?.tier ?? 'FREE';
    const custom = await prisma.aIPremiumCapability.findMany({ where: { userId } }).catch(() => []);

    return {
      tier,
      capabilities: CAPABILITIES.map((capability) => {
        const override = custom.find((item) => item.key === capability.key);
        const includedByTier = capability.tier === 'FREE' || tier === 'PREMIUM' || tier === 'BUSINESS';
        return {
          ...capability,
          enabled: override?.enabled ?? includedByTier,
          source: override?.source ?? 'tier',
        };
      }),
    };
  }
}

export const aiPremiumService = new AIPremiumService();
