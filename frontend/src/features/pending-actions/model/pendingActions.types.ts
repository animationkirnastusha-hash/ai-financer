export type PendingActionItem = {
  id: string;
  type?: string;
  intent?: string;
  command?: string;
  riskLevel?: 'low' | 'medium' | 'high' | string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  payload?: Record<string, unknown> | null;
  parsed?: Record<string, unknown> | null;
  summary?: string;
};