import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';

export function formatAuditLogItem(item: AuditLogItem) {
  const metadata = item.metadata ?? {};
  const amount =
    typeof metadata.amount === 'number'
      ? new Intl.NumberFormat('ru-RU').format(metadata.amount) + ' ₽'
      : null;

  const categoryName =
    typeof metadata.categoryName === 'string' ? metadata.categoryName : null;

  const status = item.status || '';
  const action = item.action || '';

  if (status === 'executed') {
    if (amount) {
      return `Выполнено AI-действие${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'AI выполнил действие';
  }

  if (status === 'pending_confirmation') {
    if (amount) {
      return `Ожидает подтверждения${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'AI ожидает подтверждения';
  }

  if (status === 'previewed') {
    if (amount) {
      return `Подготовлен черновик${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'AI подготовил черновик действия';
  }

  if (item.message) return item.message;
  if (action) return action;

  return 'AI action';
}