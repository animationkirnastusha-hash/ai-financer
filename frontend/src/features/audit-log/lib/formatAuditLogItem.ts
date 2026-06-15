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
      return `Действие выполнено${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'Действие выполнено';
  }

  if (status === 'pending_confirmation') {
    if (amount) {
      return `Нужно подтвердить${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'Нужно подтвердить действие';
  }

  if (status === 'previewed') {
    if (amount) {
      return `Подготовлено${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`;
    }
    return 'Действие подготовлено';
  }

  if (item.message) return item.message;
  if (action) return action;

  return 'Действие Фины';
}
