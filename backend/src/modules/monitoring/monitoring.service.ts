type ApiMetric = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string | null;
  timestamp: string;
};

type AlertItem = {
  id: string;
  level: 'warning' | 'critical';
  title: string;
  message: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

type MonitoringConfig = {
  slowRequestMs: number;
  errorRateThreshold: number;
  alertCooldownMs: number;
  alertsEnabled: boolean;
  alertWebhookUrl?: string;
};

const MAX_METRICS = 1000;
const MAX_ALERTS = 100;

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export class MonitoringService {
  private metrics: ApiMetric[] = [];
  private alerts: AlertItem[] = [];
  private lastAlertAt = new Map<string, number>();
  private readonly startedAt = new Date();

  constructor(private readonly config: MonitoringConfig) {}

  recordApiMetric(metric: ApiMetric) {
    this.metrics.push(metric);
    if (this.metrics.length > MAX_METRICS) this.metrics.shift();

    if (metric.statusCode >= 500) {
      void this.raiseAlert('critical', 'Ошибка API', `${metric.method} ${metric.path} вернул ${metric.statusCode}`, {
        statusCode: metric.statusCode,
        durationMs: metric.durationMs,
      });
    }

    if (metric.durationMs >= this.config.slowRequestMs) {
      void this.raiseAlert('warning', 'Медленный запрос', `${metric.method} ${metric.path} занял ${metric.durationMs} мс`, {
        durationMs: metric.durationMs,
      });
    }

    const recent = this.getRecentMetrics(5 * 60 * 1000);
    const errorRate = recent.length ? recent.filter((item) => item.statusCode >= 500).length / recent.length : 0;
    if (recent.length >= 20 && errorRate >= this.config.errorRateThreshold) {
      void this.raiseAlert('critical', 'Высокий процент ошибок', `Ошибки API: ${Math.round(errorRate * 100)}% за последние 5 минут`, {
        errorRate,
        sampleSize: recent.length,
      });
    }
  }

  getSnapshot() {
    const recent = this.getRecentMetrics(15 * 60 * 1000);
    const durations = recent.map((item) => item.durationMs);
    const total = recent.length;
    const errors = recent.filter((item) => item.statusCode >= 500).length;
    const slow = recent.filter((item) => item.durationMs >= this.config.slowRequestMs).length;

    const byPath = recent.reduce<Record<string, { count: number; errors: number; avgMs: number }>>((acc, item) => {
      const key = `${item.method} ${item.path}`;
      const current = acc[key] ?? { count: 0, errors: 0, avgMs: 0 };
      const nextCount = current.count + 1;
      acc[key] = {
        count: nextCount,
        errors: current.errors + (item.statusCode >= 500 ? 1 : 0),
        avgMs: Math.round((current.avgMs * current.count + item.durationMs) / nextCount),
      };
      return acc;
    }, {});

    return {
      status: errors > 0 ? 'degraded' : 'ok',
      uptimeSec: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
      windowMinutes: 15,
      totals: {
        requests: total,
        errors,
        errorRate: total ? Number((errors / total).toFixed(3)) : 0,
        slowRequests: slow,
        avgMs: total ? Math.round(durations.reduce((sum, item) => sum + item, 0) / total) : 0,
        p95Ms: percentile(durations, 95),
      },
      topEndpoints: Object.entries(byPath)
        .map(([path, value]) => ({ path, ...value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      recentAlerts: this.alerts.slice(0, 20),
    };
  }

  private getRecentMetrics(windowMs: number) {
    const from = Date.now() - windowMs;
    return this.metrics.filter((metric) => new Date(metric.timestamp).getTime() >= from);
  }

  private async raiseAlert(level: AlertItem['level'], title: string, message: string, meta?: Record<string, unknown>) {
    const key = `${level}:${title}`;
    const now = Date.now();
    const last = this.lastAlertAt.get(key) ?? 0;
    if (now - last < this.config.alertCooldownMs) return;
    this.lastAlertAt.set(key, now);

    const alert: AlertItem = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      title,
      message,
      createdAt: new Date(now).toISOString(),
      meta,
    };

    this.alerts.unshift(alert);
    this.alerts = this.alerts.slice(0, MAX_ALERTS);

    if (!this.config.alertsEnabled || !this.config.alertWebhookUrl) return;

    try {
      await fetch(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('[Monitoring] alert webhook failed:', error);
    }
  }
}
