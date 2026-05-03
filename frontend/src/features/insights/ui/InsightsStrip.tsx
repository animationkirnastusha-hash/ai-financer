import { buildInsights } from '@/features/insights/lib/buildInsights';
import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { InsightCard } from '@/features/insights/ui/InsightCard';

type Props = {
  pendingActions: PendingActionItem[];
  auditLogs: AuditLogItem[];
  onOpenPending: () => void;
  onOpenAudit: () => void;
};

export function InsightsStrip({
  pendingActions,
  auditLogs,
  onOpenPending,
  onOpenAudit,
}: Props) {
  const insights = buildInsights({ pendingActions, auditLogs });

  const handleClick = (kind: string) => {
    if (kind === 'pending_attention') {
      onOpenPending();
      return;
    }

    if (kind === 'audit_activity') {
      onOpenAudit();
      return;
    }
  };

  return (
    <div className="px-4 pb-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/32">
        AI Insights
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {insights.map((item) => (
          <InsightCard
            key={item.id}
            item={item}
            onClick={
              item.kind === 'pending_attention' || item.kind === 'audit_activity'
                ? () => handleClick(item.kind)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}