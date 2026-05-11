import type { XPRuleKey } from './xp-rules';

export type ActivityType =
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

export interface AddProgressionInput {
  userId: string;
  rule: XPRuleKey;
  type: ActivityType;
  payload?: unknown;
}

export interface ProgressionSnapshot {
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
}
