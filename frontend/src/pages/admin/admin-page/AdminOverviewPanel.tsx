import type { AdminOverview } from '@/features/admin/api/admin.api';
import { formatDuration } from './adminPage.formatters';
import { MetricCard } from './MetricCard';

type Props = {
  overview: AdminOverview;
};

export function AdminOverviewPanel({ overview }: Props) {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <MetricCard title="Пользователи" value={overview.metrics.usersTotal} caption={`+${overview.metrics.usersToday} сегодня`} />
        <MetricCard title="Активные 30д" value={overview.metrics.activeUsers30d} caption={`+${overview.metrics.users7d} за 7 дней`} />
        <MetricCard title="Операции" value={overview.metrics.transactionsTotal} caption={`+${overview.metrics.transactionsToday} сегодня`} />
        <MetricCard title="События" value={overview.metrics.eventsToday} caption="сегодня" />
      </section>

      <section className="app-card">
        <div className="app-section-title">Откуда пришли</div>
        <div className="mt-4 space-y-2">
          {overview.acquisition.length ? overview.acquisition.slice(0, 8).map((item) => (
            <div key={item.source} className="app-admin-row">
              <span>{item.source}</span>
              <b>{item.count}</b>
            </div>
          )) : <div className="text-sm text-white/42">Пока нет данных.</div>}
        </div>
      </section>

      <section className="app-card">
        <div className="app-section-title">Где бывают чаще</div>
        <div className="mt-4 grid gap-2">
          {overview.screens.length ? overview.screens.slice(0, 8).map((item) => (
            <div key={item.screen} className="app-admin-row">
              <span>{item.screen}</span>
              <b>{item.count}</b>
            </div>
          )) : <div className="text-sm text-white/42">Переходы ещё не записаны.</div>}
        </div>
      </section>

      <section className="app-card">
        <div className="app-section-title">Где отваливаются</div>
        <div className="mt-4 grid gap-2">
          {overview.dropoff?.length ? overview.dropoff.slice(0, 8).map((item) => (
            <div key={item.screen} className="app-admin-row">
              <span>{item.screen}</span>
              <small>{formatDuration(item.avgDurationMs)}</small>
              <b>{item.exits}</b>
            </div>
          )) : <div className="text-sm text-white/42">Данные появятся после нескольких переходов между экранами.</div>}
        </div>
      </section>

      <section className="app-card">
        <div className="app-section-title">Воронка</div>
        <div className="mt-4 grid gap-2">
          {overview.funnel.map((item) => (
            <div key={item.step} className="app-admin-row">
              <span>{item.step}</span>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
