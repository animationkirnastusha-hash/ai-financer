import { apiClient } from '@/shared/api/client';

export type PremiumCapabilitiesDto = {
  tier?: 'FREE' | 'PREMIUM' | 'ADMIN' | string;
  capabilities?: Record<string, boolean>;
};

const fallback: PremiumCapabilitiesDto = {
  tier: 'FREE',
  capabilities: {
    basic_ai_control: true,
    basic_voice: true,
    basic_analytics: true,
    companion_basic: true,
    advanced_memory: false,
    proactive_insights: false,
    advanced_automation: false,
    premium_companion: false,
    deep_analytics: false,
  },
};

export const premiumApi = {
  async getCapabilities() {
    try {
      return await apiClient.get<PremiumCapabilitiesDto>('/premium/capabilities');
    } catch {
      return fallback;
    }
  },

  async toggleDevTier(tier: 'FREE' | 'PREMIUM') {
    return apiClient.post<PremiumCapabilitiesDto>('/premium/dev/toggle-tier', { tier });
  },
};
