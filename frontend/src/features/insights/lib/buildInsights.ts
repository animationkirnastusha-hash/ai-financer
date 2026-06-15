import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';
import type { InsightItem } from '@/features/insights/model/insight.types';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';

type BuildInsightsParams = {
  pendingActions: PendingActionItem[];
  auditLogs: AuditLogItem[];
};

function countExecuted(auditLogs: AuditLogItem[]) {
  return auditLogs.filter((item) => item.status === 'executed').length;
}

function countPendingConfirmations(auditLogs: AuditLogItem[]) {
  return auditLogs.filter((item) => item.status === 'pending_confirmation').length;
}

function countPreviewed(auditLogs: AuditLogItem[]) {
  return auditLogs.filter((item) => item.status === 'previewed').length;
}

export function buildInsights({
  pendingActions,
  auditLogs,
}: BuildInsightsParams): InsightItem[] {
  const items: InsightItem[] = [];

  const executedCount = countExecuted(auditLogs);
  const pendingAuditCount = countPendingConfirmations(auditLogs);
  const previewedCount = countPreviewed(auditLogs);

  if (pendingActions.length > 0) {
    items.push({
      id: 'pending-attention',
      kind: 'pending_attention',
      tone: 'warning',
      title: `Нужно проверить: ${pendingActions.length}`,
      description:
        pendingActions.length === 1
          ? 'Есть одно действие, требующее внимания.'
          : 'Есть несколько действий, требующих внимания.',
      ctaLabel: 'Проверить',
    });
  }

  if (executedCount > 0) {
    items.push({
      id: 'audit-executed',
      kind: 'audit_activity',
      tone: 'positive',
      title: `Готовых действий: ${executedCount}`,
      description: 'Операции уже сохранены в журнале.',
      ctaLabel: 'Открыть журнал',
    });
  }

  if (previewedCount > 0) {
    items.push({
      id: 'drafts-previewed',
      kind: 'ai_state',
      tone: 'ai',
      title: `Подготовлено: ${previewedCount}`,
      description: 'Фина подготовила действия для проверки.',
    });
  }

  if (pendingAuditCount > 0) {
    items.push({
      id: 'audit-pending',
      kind: 'pending_attention',
      tone: 'warning',
      title: `Ожидают подтверждения: ${pendingAuditCount}`,
      description: 'Есть действия, которые пока не завершены.',
      ctaLabel: 'Проверить',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'ai-ready',
      kind: 'ai_state',
      tone: 'neutral',
      title: 'Фина готова',
      description:
        'Напиши, например: «Потратил на кофе», «Получил зарплату» или «Перевёл на накопления».',
    });
  }

  return items.slice(0, 3);
}