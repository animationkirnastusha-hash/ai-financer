export const XP_RULES = {
  DAILY_ACTIVITY: 5,
  EXPENSE_CREATED: 2,
  INCOME_CREATED: 2,
  ACCOUNT_CREATED: 5,
  TRANSFER_CREATED: 4,
  CATEGORY_CREATED: 4,
  SECTION_CREATED: 4,
  BUDGET_CREATED: 8,
  STREAK_BONUS: 10,
  GOAL_COMPLETED: 50,
  REFERRAL_REGISTERED: 20,
  REFERRAL_ACTIVE: 100,
} as const;

export type XPRuleKey = keyof typeof XP_RULES;

export function levelFromXP(xp: number) {
  const safeXP = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.max(1, Math.floor(Math.sqrt(safeXP / 75)) + 1);
}

export function companionLevelFromXP(xp: number) {
  const safeXP = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.max(1, Math.floor(Math.sqrt(safeXP / 120)) + 1);
}
