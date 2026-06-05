import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useNotificationsStore } from '@/features/notifications/model/notifications.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';

type Props = {
  open: boolean;
  layer?: number;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function NotificationSheet({ open, layer = 80, onClose }: Props) {
  const items = useNotificationsStore((state) => state.items);
  const isLoading = useNotificationsStore((state) => state.isLoading);
  const error = useNotificationsStore((state) => state.error);
  const load = useNotificationsStore((state) => state.load);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const remove = useNotificationsStore((state) => state.remove);
  const loans = useObligationsStore((state) => state.loans);
  const markLoanPaid = useObligationsStore((state) => state.markPaid);
  const loadObligations = useObligationsStore((state) => state.loadAll);
  const openModal = useAppModalStore((state) => state.openModal);
  const closeAllModals = useAppModalStore((state) => state.closeAllModals);
  const openSettingsSection = useNavigationStore((state) => state.openSettingsSection);

  useEffect(() => {
    if (open) void Promise.allSettled([load(true), loadObligations(false)]);
  }, [load, loadObligations, open]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  if (!open) return null;

  const handleOpenRelated = async (notificationId: string, entityId?: string | null) => {
    await markRead(notificationId);
    if (!entityId) return;
    const loan = loans.find((item) => item.id === entityId) ?? null;
    closeAllModals();
    openModal({ type: 'obligation-edit', loan });
  };

  const handleMarkPaid = async (notificationId: string, entityId?: string | null) => {
    if (!entityId) return;
    const loan = loans.find((item) => item.id === entityId);
    if (!loan) return;
    await markLoanPaid(loan.id, {
      amount: loan.monthlyPayment,
      accountId: loan.accountId ?? null,
      createExpense: loan.autoCreateExpense,
    });
    await markRead(notificationId);
    await load(true);
  };

  return (
    <div className="app-modal-backdrop notification-backdrop" data-no-swipe="true" onClick={onClose} style={{ zIndex: layer }}>
      <div className="app-modal-sheet notification-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body notification-sheet__body">
          <div className="notification-sheet__head">
            <div>
              <div className="app-eyebrow">Уведомления</div>
              <h2>Что важно</h2>
              <p>{unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Новых уведомлений нет'}</p>
            </div>
            <div className="notification-sheet__head-actions">
              <button
                type="button"
                className="app-icon-button"
                aria-label="Настройки уведомлений"
                onClick={() => {
                  closeAllModals();
                  openSettingsSection('notifications');
                }}
              >
                ⚙
              </button>
              <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button>
            </div>
          </div>

          <div className="notification-sheet__toolbar">
            <button type="button" className="app-secondary-button app-secondary-button--compact" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
              Прочитать все
            </button>
          </div>

          {error ? <div className="app-status-box app-status-box--error">{error}</div> : null}

          <div className="notification-list">
            {isLoading && items.length === 0 ? (
              <div className="notification-empty">Загружаю уведомления…</div>
            ) : items.length === 0 ? (
              <div className="notification-empty">
                <b>Пока пусто</b>
                <span>Здесь появятся платежи, просрочки и важные события.</span>
              </div>
            ) : items.map((item) => (
              <article key={item.id} className="notification-card" data-unread={!item.isRead} data-severity={item.severity || 'info'}>
                <div className="notification-card__main">
                  <div className="notification-card__top">
                    <b>{item.title}</b>
                    <small>{formatDate(item.dueAt || item.createdAt)}</small>
                  </div>
                  <p>{item.message}</p>
                </div>
                <div className="notification-card__actions">
                  {item.relatedEntityType === 'obligation' ? (
                    <button type="button" className="app-small-link" onClick={() => void handleOpenRelated(item.id, item.relatedEntityId)}>
                      Открыть
                    </button>
                  ) : null}
                  {item.action === 'mark_obligation_paid' ? (
                    <button type="button" className="app-small-link" onClick={() => void handleMarkPaid(item.id, item.relatedEntityId)}>
                      Оплатил
                    </button>
                  ) : null}
                  {!item.isRead ? (
                    <button type="button" className="app-small-link" onClick={() => void markRead(item.id)}>
                      Прочитано
                    </button>
                  ) : null}
                  <button type="button" className="app-small-link app-small-link--muted" onClick={() => void remove(item.id)}>
                    Скрыть
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
