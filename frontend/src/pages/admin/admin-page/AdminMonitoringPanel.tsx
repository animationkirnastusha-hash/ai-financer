import type { AdminMonitoring } from './adminPage.types';
import { MetricCard } from './MetricCard';

type Props = {
  monitoring: AdminMonitoring;
};

export function AdminMonitoringPanel({ monitoring }: Props) {
  return (
    <div className="admin-panel-stack">
      <section className="admin-metric-grid">
        <MetricCard title="Статус" value={monitoring.status} caption={`работает ${Math.round(monitoring.uptimeSec / 60)} мин`} />
        <MetricCard title="Ошибки" value={`${Math.round(monitoring.totals.errorRate * 100)}%`} caption={`${monitoring.totals.errors}/${monitoring.totals.requests} запросов`} />
        <MetricCard title="Пик" value={`${monitoring.totals.p95Ms} мс`} caption="медленные ответы" />
        <MetricCard title="Среднее" value={`${monitoring.totals.avgMs} мс`} caption={`${monitoring.totals.slowRequests} медленных`} />
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Частые запросы</div>
        <div className="admin-row-list">
          {monitoring.topEndpoints.map((item) => (
            <div key={item.path} className="admin-row">
              <span>{item.path}</span>
              <small>{item.avgMs} мс</small>
              <b>{item.errors ? `${item.errors} ош.` : item.count}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card admin-section-card">
        <div className="admin-section-title">Предупреждения</div>
        <div className="admin-row-list">
          {monitoring.recentAlerts.length ? monitoring.recentAlerts.map((item) => (
            <div key={item.id} className="admin-alert-card" data-level={item.level}>
              <b>{item.title}</b>
              <span>{item.message}</span>
            </div>
          )) : <div className="admin-empty-text">Предупреждений нет.</div>}
        </div>
      </section>
    </div>
  );
}
