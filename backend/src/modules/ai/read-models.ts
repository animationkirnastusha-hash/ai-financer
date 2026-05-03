export interface AIPendingActionView {
  id: string;
  command: string;
  intent: string;
  riskLevel: string;
  status: string;
  parsed: Record<string, unknown> | null;
  expiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIAuditLogView {
  id: string;
  command: string;
  intent: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  executed: boolean;
  status: string;
  parsed: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}