import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminEvent, type AdminOverview, type AdminUser } from '@/features/admin/api/admin.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type Tab = 'overview' | 'users' | 'events' | 'monitoring';

function MetricCard({ title, value, caption }: { title: string; value: string | number; caption?: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-white/34">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      {caption ? <div className="mt-1 text-xs text-white/42">{caption}</div> : null}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(user?.isAdmin);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      adminApi.overview(),
      adminApi.users(),
      adminApi.events(),
    ])
      .then(([overviewPayload, usersPayload, eventsPayload]) => {
        if (cancelled) return;
        setOverview(overviewPayload);
        setUsers(usersPayload.users);
        setEvents(eventsPayload.events);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить админ-данные');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const monitoring = overview?.monitoring;
  const tabs = useMemo<Array<{ id: Tab; title: string }>>(
    () => [
      { id: 'overview', title: 'Обзор' },
      { id: 'users', title: 'Пользователи' },
      { id: 'events', title: 'События' },
      { id: 'monitoring', title: 'Сервер' },
    ],
    [],
  );

  if (!isAdmin) {
    return (
      <div className="h-full overflow-y-auto px-4 pb-28 pt-4 text-white">
        <div className="mx-auto max-w-[720px] space-y-4">
          <ScreenTopBar title="Админ" left="back" right={['home']} />
          <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5">
            <div className="text-lg font-semibold">Недоступно</div>
            <div className="mt-2 text-sm text-white/50">Этот раздел скрыт для обычных пользователей.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4 text-white">
      <div className="mx-auto max-w-[760px] space-y-4">
        <ScreenTopBar title="Админ" left="back" right={['home']} />

        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">закрытый раздел</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Админ-панель</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">Статистика, события, отвал пользователей и состояние API.</p>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1" data-no-swipe="true">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                tab === item.id ? 'border-emerald-300/40 bg-emerald-300/12 text-emerald-100' : 'border-white/10 bg-white/[0.035] text-white/55'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        {isLoading ? <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">Загрузка…</div> : null}
        {error ? <div className="rounded-[26px] border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-100">{error}</div> : null}

        {tab === 'overview' && overview ? (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3">
              <MetricCard title="Пользователи" value={overview.metrics.usersTotal} caption={`+${overview.metrics.usersToday} сегодня`} />
              <MetricCard title="Активные 30д" value={overview.metrics.activeUsers30d} caption={`+${overview.metrics.users7d} за 7 дней`} />
              <MetricCard title="Операции" value={overview.metrics.transactionsTotal} caption={`+${overview.metrics.transactionsToday} сегодня`} />
              <MetricCard title="Pending AI" value={overview.metrics.pendingActions} caption="ждут подтверждения" />
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-lg font-semibold">Откуда пришли</div>
              <div className="mt-4 space-y-2">
                {overview.acquisition.slice(0, 8).map((item) => (
                  <div key={item.source} className="flex items-center justify-between rounded-[18px] bg-black/18 px-4 py-3 text-sm">
                    <span className="truncate text-white/70">{item.source}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-lg font-semibold">Где бывают чаще</div>
              <div className="mt-4 grid gap-2">
                {overview.screens.slice(0, 8).map((item) => (
                  <div key={item.screen} className="flex items-center justify-between rounded-[18px] bg-black/18 px-4 py-3 text-sm">
                    <span className="text-white/70">{item.screen}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-lg font-semibold">Воронка</div>
              <div className="mt-4 grid gap-2">
                {overview.funnel.map((item) => (
                  <div key={item.step} className="flex items-center justify-between rounded-[18px] bg-black/18 px-4 py-3 text-sm">
                    <span className="text-white/70">{item.step}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'users' ? (
          <section className="space-y-3">
            {users.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{item.firstName} {item.lastName ?? ''}</div>
                    <div className="mt-1 text-xs text-white/42">@{item.username ?? '—'} · {item.telegramId}</div>
                  </div>
                  <div className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">{item.tier}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-white/55">
                  <div className="rounded-[16px] bg-black/18 p-2">Счета<br /><b className="text-white">{item._count.accounts}</b></div>
                  <div className="rounded-[16px] bg-black/18 p-2">Операции<br /><b className="text-white">{item._count.transactions}</b></div>
                  <div className="rounded-[16px] bg-black/18 p-2">Рефералы<br /><b className="text-white">{item._count.referrals}</b></div>
                </div>
                <div className="mt-3 text-xs text-white/34">Создан: {formatDate(item.createdAt)} · Был: {formatDate(item.lastActiveAt)}</div>
              </div>
            ))}
          </section>
        ) : null}

        {tab === 'events' ? (
          <section className="space-y-2">
            {events.map((item) => (
              <div key={item.id} className="rounded-[20px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{item.event}</div>
                  <div className="text-xs text-white/34">{formatDate(item.createdAt)}</div>
                </div>
                <div className="mt-1 text-xs text-white/42">{item.user?.firstName ?? 'Без пользователя'} {item.user?.username ? `@${item.user.username}` : ''}</div>
                {item.data ? <pre className="mt-3 max-h-32 overflow-auto rounded-[14px] bg-black/25 p-3 text-[11px] text-white/45">{JSON.stringify(item.data, null, 2)}</pre> : null}
              </div>
            ))}
          </section>
        ) : null}

        {tab === 'monitoring' && monitoring ? (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3">
              <MetricCard title="Статус" value={monitoring.status === 'ok' ? 'OK' : 'Проблема'} caption={`uptime ${monitoring.uptimeSec}s`} />
              <MetricCard title="Ошибки" value={monitoring.totals.errors} caption={`${Math.round(monitoring.totals.errorRate * 100)}%`} />
              <MetricCard title="P95" value={`${monitoring.totals.p95Ms}мс`} caption={`avg ${monitoring.totals.avgMs}мс`} />
              <MetricCard title="Медленные" value={monitoring.totals.slowRequests} caption={`${monitoring.windowMinutes} минут`} />
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-lg font-semibold">Эндпоинты</div>
              <div className="mt-4 space-y-2">
                {monitoring.topEndpoints.map((item) => (
                  <div key={item.path} className="rounded-[18px] bg-black/18 px-4 py-3 text-sm">
                    <div className="truncate text-white/70">{item.path}</div>
                    <div className="mt-1 text-xs text-white/38">{item.count} запросов · {item.errors} ошибок · {item.avgMs}мс</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-lg font-semibold">Алерты</div>
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
        ) : null}
      </div>
    </div>
  );
}
