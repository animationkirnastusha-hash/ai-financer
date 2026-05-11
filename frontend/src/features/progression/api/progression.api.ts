import { env } from '@/shared/config/env';

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

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function readPayload(response: Response) {
  return response.json().catch(() => null);
}

function getErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message || payload?.message || fallback;
}

export async function fetchProgression(): Promise<ProgressionSnapshotDto> {
  const response = await fetch(`${env.apiBaseUrl}/progression/me`, {
    headers: getAuthHeaders(),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Не удалось загрузить прогресс'));
  }

  return payload;
}

export async function trackProgressionActivity(input: {
  type: ProgressionActivityType;
  payload?: unknown;
}) {
  const response = await fetch(`${env.apiBaseUrl}/progression/activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Не удалось записать активность'));
  }

  return payload;
}

export async function applyReferralCode(code: string): Promise<ProgressionSnapshotDto> {
  const response = await fetch(`${env.apiBaseUrl}/progression/referral/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ code }),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Не удалось применить реферальный код'));
  }

  return payload;
}
