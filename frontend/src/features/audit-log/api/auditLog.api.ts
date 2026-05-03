import { apiClient } from '@/shared/api/client';
import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';

type AuditLogsResponse =
  | AuditLogItem[]
  | { items?: AuditLogItem[]; auditLogs?: AuditLogItem[] };

export const auditLogApi = {
  list: async (): Promise<AuditLogItem[]> => {
    const response = await apiClient.get<AuditLogsResponse>('/ai/audit-logs');

    if (Array.isArray(response)) return response;
    if (Array.isArray(response.items)) return response.items;
    if (Array.isArray(response.auditLogs)) return response.auditLogs;

    return [];
  },
};