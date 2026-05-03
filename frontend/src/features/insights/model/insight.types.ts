export type InsightTone = 'neutral' | 'positive' | 'warning' | 'ai';

export type InsightItem = {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  ctaLabel?: string;
  kind:
    | 'spending_pattern'
    | 'income_detected'
    | 'pending_attention'
    | 'audit_activity'
    | 'ai_state';
};