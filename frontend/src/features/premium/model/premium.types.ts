export type PremiumTriggerKind =
  | 'locked_insight'
  | 'risk_forecast'
  | 'success_boost'
  | 'deep_analysis'
  | 'premium_voice'
  | 'goal_planner';

export type PremiumTrigger = {
  kind: PremiumTriggerKind;
  title: string;
  description: string;
  cta: string;
  value?: string;
};