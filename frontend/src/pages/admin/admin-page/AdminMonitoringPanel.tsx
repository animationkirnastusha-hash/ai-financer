import type { AdminMonitoring } from './adminPage.types';
import { MetricCard } from './MetricCard';

type Props = {
  monitoring: AdminMonitoring;
};

export function AdminMonitoringPanel({ monitoring }: Props) {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <MetricCard title="Статус" value={monitoring.status} caption={`uptime ${Math.round(monitoring.uptimeSec / 60)} мин`} />
        <MetricCard title="Ошибки" value={`${Math.round(monitoring.totals.errorRate * 100)}%`} caption={`${monitoring.totals.errors}/${monitoring.totals.requests} запросов`} />
        <MetricCard title="p95" value={`${monitoring.totals.p95Ms} мс`} caption="медленные ответы" />
        <MetricCard title="Среднее" value={`${monitoring.totals.avgMs} мс`} caption={`${monitoring.totals.slowRequests} slow`} />
      </section>

      <section className="app-card">
        <div className="app-section-title">Endpoints</div>
        <div className="mt-4 space-y-2">
          {monitoring.topEndpoints.map((item) => (
            <div key={item.path} className="app-admin-row">
              <span>{item.path}</span>
              <small>{item.avgMs} мс</small>
              <b>{item.errors ? `${item.errors} err` : item.count}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card">
        <div className="app-section-title">Алерты</div>
        <div className="mt-4 space-y-2">
          {monitoring.recentAlerts.length ? monitoring.recentAlerts.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-sm">
              <div className={item.level === 'critical' ? 'text-red-200' : 'text-amber-100'}>{item.title}</div>
              <div className="mt-1 text-xs text-white/45">{item.message}</div>
            </div>
          )) : <div className="text-sm text-white/42">Алертов нет.</div>}
        </div>
      </section>
    </div>
  );
}
