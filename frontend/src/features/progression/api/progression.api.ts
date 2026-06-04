import { apiClient } from '@/shared/api/client';


export type ProgressionActivityType =
  | 'daily_activity'
  | 'expense_created'
  | 'income_created'
  | 'account_created'
  | 'transfer_created'
  | 'category_created'
  | 'section_created'
  | 'budget_created'
  | 'goal_completed'
  | 'referral_registered'
  | 'referral_active'
  | 'ai_action_confirmed'
  | 'manual_action_completed';

export type ProgressionSnapshotDto = {
  xp: number;
  level: number;
  streakDays: number;
  lastActiveAt: string | null;
  companionLevel: number;
  companionMood: string;
  referralCode: string | null;
  referralBalance: number;
  activitiesToday: number;
  recentActivities: Array<{
    id: string;
    type: string;
    xpEarned: number;
    payload: unknown;
    createdAt: string;
  }>;
  achievements: Array<{
    key: string;
    title: string;
    description: string;
    icon: string | null;
    xpReward: number;
    unlockedAt: string;
  }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function fetchProgression(): Promise<ProgressionSnapshotDto> {
  try {
    return await apiClient.get<ProgressionSnapshotDto>('/progression/me');
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось загрузить прогресс'));
  }
}

export async function trackProgressionActivity(input: {
  type: ProgressionActivityType;
  payload?: unknown;
}) {
  try {
    return await apiClient.post('/progression/activity', input);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось записать активность'));
  }
}

export async function applyReferralCode(code: string): Promise<ProgressionSnapshotDto> {
  try {
    return await apiClient.post<ProgressionSnapshotDto>('/progression/referral/apply', { code });
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось применить реферальный код'));
  }
}
