import type { AdminEvent } from '@/features/admin/api/admin.api';
import { formatDate } from './adminPage.formatters';

type Props = {
  events: AdminEvent[];
};

export function AdminEventsPanel({ events }: Props) {
  return (
    <section className="admin-events-list">
      {events.map((item) => (
        <article key={item.id} className="app-card admin-event-card">
          <div className="admin-event-card__head">
            <div>
              <div className="admin-event-card__title">{item.event}</div>
              <div className="admin-event-card__meta">{item.user?.firstName ?? 'Без пользователя'} · @{item.user?.username ?? '—'}</div>
            </div>
            <div className="admin-event-card__meta">{formatDate(item.createdAt)}</div>
          </div>
          {item.data ? <pre>{JSON.stringify(item.data, null, 2)}</pre> : null}
        </article>
      ))}
    </section>
  );
}
