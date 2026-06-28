import type { AdminOverview } from '@/features/admin/api/admin.api';
import { formatDuration } from './adminPage.formatters';
import { MetricCard } from './MetricCard';

type Props = {
  overview: AdminOverview;
};

export function AdminOverviewPanel({ overview }: Props) {
  return (
    <div className="admin-panel-stack">
      <section className="admin-metric-grid">
        <MetricCard title="Пользователи" value={overview.metrics.usersTotal} caption={`+${overview.metrics.usersToday} сегодня`} />
        <MetricCard title="Активные 30д" value={overview.metrics.activeUsers30d} caption={`+${overview.metrics.users7d} за 7 дней`} />
        <MetricCard title="Операции" value={overview.metrics.transactionsTotal} caption={`+${overview.metrics.transactionsToday} сегодня`} />
        <MetricCard title="События" value={overview.metrics.eventsToday} caption="сегодня" />
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Откуда пришли</div>
        <div className="admin-row-list">
          {overview.acquisition.length ? overview.acquisition.slice(0, 8).map((item) => (
            <div key={item.source} className="admin-row">
              <span>{item.source}</span>
              <b>{item.count}</b>
            </div>
          )) : <div className="admin-empty-text">Пока нет данных.</div>}
        </div>
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Где бывают чаще</div>
        <div className="admin-row-list">
          {overview.screens.length ? overview.screens.slice(0, 8).map((item) => (
            <div key={item.screen} className="admin-row">
              <span>{item.screen}</span>
              <b>{item.count}</b>
            </div>
          )) : <div className="admin-empty-text">Переходы ещё не записаны.</div>}
        </div>
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Где отваливаются</div>
        <div className="admin-row-list">
          {overview.dropoff?.length ? overview.dropoff.slice(0, 8).map((item) => (
            <div key={item.screen} className="admin-row">
              <span>{item.screen}</span>
              <small>{formatDuration(item.avgDurationMs)}</small>
              <b>{item.exits}</b>
            </div>
          )) : <div className="admin-empty-text">Данные появятся после нескольких переходов между экранами.</div>}
        </div>
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Воронка</div>
        <div className="admin-row-list">
          {overview.funnel.map((item) => (
            <div key={item.step} className="admin-row">
              <span>{item.step}</span>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
