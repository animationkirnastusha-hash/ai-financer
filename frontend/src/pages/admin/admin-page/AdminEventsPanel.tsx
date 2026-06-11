import type { AdminEvent } from '@/features/admin/api/admin.api';
import { formatDate } from './adminPage.formatters';

type Props = {
  events: AdminEvent[];
};

export function AdminEventsPanel({ events }: Props) {
  return (
    <section className="space-y-3">
      {events.map((item) => (
        <div key={item.id} className="app-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{item.event}</div>
              <div className="mt-1 text-xs text-white/42">{item.user?.firstName ?? 'Без пользователя'} · @{item.user?.username ?? '—'}</div>
            </div>
            <div className="text-xs text-white/38">{formatDate(item.createdAt)}</div>
          </div>
          {item.data ? <pre className="mt-3 max-h-32 overflow-auto rounded-[18px] bg-black/24 p-3 text-xs text-white/50">{JSON.stringify(item.data, null, 2)}</pre> : null}
        </div>
      ))}
    </section>
  );
}
