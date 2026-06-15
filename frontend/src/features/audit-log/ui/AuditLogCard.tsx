import { Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';
import { formatAuditLogItem } from '@/features/audit-log/lib/formatAuditLogItem';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  item: AuditLogItem;
};

function getStatusTone(status?: string) {
  if (status === 'executed') return 'text-emerald-300/75';
  if (status === 'pending_confirmation') return 'text-amber-300/75';
  if (status === 'previewed') return 'text-cyan-300/75';
  if (status === 'failed') return 'text-rose-300/75';

  return 'text-white/55';
}

function getStatusLabel(status?: string) {
  if (status === 'executed') return 'Выполнено';
  if (status === 'pending_confirmation') return 'Ожидает подтверждения';
  if (status === 'previewed') return 'Подготовлено';
  if (status === 'failed') return 'Ошибка';
  if (status === 'cancelled') return 'Отменено';
  if (status === 'undone') return 'Отменено';

  return status || 'Неизвестно';
}

export function AuditLogCard({ item }: Props) {
  const { t } = useI18n();
  const time = item.createdAt || item.created_at;

  return (
    <Surface className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">
            {t('audit.card.label')}
          </div>

          <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-white">
            {formatAuditLogItem(item)}
          </div>

          <div className={`mt-2 text-xs ${getStatusTone(item.status)}`}>
            {getStatusLabel(item.status)}
          </div>
        </div>

        <div className="shrink-0 text-[11px] text-white/35">
          {formatTime(time)}
        </div>
      </div>
    </Surface>
  );
}
