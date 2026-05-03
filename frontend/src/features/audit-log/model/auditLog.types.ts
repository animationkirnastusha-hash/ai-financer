export type AuditLogItem = {
  id: string;
  action?: string;
  status?: string;
  message?: string;
  createdAt?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};