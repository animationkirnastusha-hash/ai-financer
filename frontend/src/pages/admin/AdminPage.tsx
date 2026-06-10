import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminAITrainingExample, type AdminEvent, type AdminOverview, type AdminUser } from '@/features/admin/api/admin.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { HttpError } from '@/shared/api/http';

type Tab = 'overview' | 'users' | 'events' | 'monitoring' | 'training' | 'tools';

type LoadError = {
  overview?: string;
  users?: string;
  events?: string;
};

function MetricCard({ title, value, caption }: { title: string; value: string | number; caption?: string }) {
  return (
    <div className="app-stat-card">
      <div className="app-stat-card__label">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      {caption ? <div className="mt-1 text-xs text-white/42">{caption}</div> : null}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatSubscriptionDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

function formatDuration(ms: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} мс`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  return `${Math.round(sec / 60)} мин`;
}

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    const payload = error.payload as string | { error?: { message?: string; code?: string }; message?: string } | null;
    if (typeof payload === 'string') return payload || `HTTP ${error.status}`;
    if (payload && typeof payload === 'object') return payload.error?.message || payload.message || `HTTP ${error.status}`;
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка';
}

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [trainingExamples, setTrainingExamples] = useState<AdminAITrainingExample[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<LoadError>({});
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [subscriptionBusy, setSubscriptionBusy] = useState<string | null>(null);
  const [subscriptionDays, setSubscriptionDays] = useState<Record<string, string>>({});
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, string>>({});
  const [trainingBusyId, setTrainingBusyId] = useState<string | null>(null);
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);
  const [premiumPreviewEnabled, setPremiumPreviewEnabled] = useState(() => localStorage.getItem('ai-financer-premium-preview') === '1');
  const replayOnboarding = useOnboardingStore((state) => state.reset);

  const isAdmin = Boolean(user?.isAdmin);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setIsLoading(true);
    setErrors({});

    Promise.allSettled([
      adminApi.overview(),
      adminApi.users(),
      adminApi.events(),
    ])
      .then(([overviewResult, usersResult, eventsResult]) => {
        if (cancelled) return;
        const nextErrors: LoadError = {};

        if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
        else nextErrors.overview = errorMessage(overviewResult.reason);

        if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users);
        else nextErrors.users = errorMessage(usersResult.reason);

        if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value.events);
        else nextErrors.events = errorMessage(eventsResult.reason);

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const monitoring = overview?.monitoring;

  const reloadUsers = async () => {
    const payload = await adminApi.users();
    setUsers(payload.users);
  };

  const loadTrainingExamples = async () => {
    setIsTrainingLoading(true);
    try {
      const payload = await adminApi.aiTraining();
      setTrainingExamples(payload.items);
      setTrainingDrafts((current) => {
        const next = { ...current };
        payload.items.forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = item.correctedOutput ?? '';
        });
        return next;
      });
    } finally {
      setIsTrainingLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || tab !== 'training') return;
    void loadTrainingExamples();
  }, [isAdmin, tab]);

  const handleSaveTrainingExample = async (exampleId: string, success: boolean) => {
    setTrainingBusyId(exampleId);
    try {
      const correctedOutput = trainingDrafts[exampleId] ?? '';
      const response = await adminApi.updateAITraining(exampleId, { correctedOutput, success });
      setTrainingExamples((items) => items.map((item) => item.id === exampleId ? response.result : item));
    } finally {
      setTrainingBusyId(null);
    }
  };


  const togglePremiumPreview = () => {
    const next = !premiumPreviewEnabled;
    setPremiumPreviewEnabled(next);
    localStorage.setItem('ai-financer-premium-preview', next ? '1' : '0');
  };

  const handleResetUser = async (userId: string, mode: 'finance' | 'full') => {
    const text = mode === 'finance'
      ? 'Очистить финансы этого пользователя? Прогресс останется.'
      : 'Полностью обнулить тестера? Профиль останется, но прогресс будет сброшен.';

    if (!window.confirm(text)) return;

    setResettingUserId(userId + ':' + mode);
    try {
      await adminApi.resetUser(userId, mode);
      await reloadUsers();
      if (overview) setOverview(await adminApi.overview());
    } finally {
      setResettingUserId(null);
    }
  };

  const handleGrantSubscription = async (userId: string, product: 'premium' | 'business', lifetime = false) => {
    const days = Number(subscriptionDays[userId] || '30');
    setSubscriptionBusy(`${userId}:${product}:${lifetime ? 'forever' : 'days'}`);
    try {
      if (lifetime) await adminApi.grantLifetimeSubscription(userId, product);
      else await adminApi.grantSubscription(userId, product, Number.isFinite(days) ? days : 30);
      await reloadUsers();
      if (overview) setOverview(await adminApi.overview());
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const handleRevokeSubscription = async (userId: string, product: 'premium' | 'business') => {
    setSubscriptionBusy(`${userId}:${product}:revoke`);
    try {
      await adminApi.revokeSubscription(userId, product);
      await reloadUsers();
      if (overview) setOverview(await adminApi.overview());
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const handleRestartTrial = async (userId: string) => {
    setSubscriptionBusy(`${userId}:trial`);
    try {
      await adminApi.restartTrial(userId);
      await reloadUsers();
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const tabs = useMemo<Array<{ id: Tab; title: string }>>(
    () => [
      { id: 'overview', title: 'Обзор' },
      { id: 'users', title: 'Пользователи' },
      { id: 'events', title: 'События' },
      { id: 'monitoring', title: 'Сервер' },
      { id: 'training', title: 'Фина' },
      { id: 'tools', title: 'Инструменты' },
    ],
    [],
  );

  if (!isAdmin) {
    return (
      <div className="app-page text-white">
        <div className="app-page__inner space-y-4">
          <ScreenTopBar title="Админ" left="back" right={['home']} />
          <div className="app-card">
            <div className="text-lg font-semibold">Недоступно</div>
            <div className="mt-2 text-sm text-white/50">Этот раздел скрыт для обычных пользователей.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Админ" left="back" right={['home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Закрытый раздел</div>
          <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.05em]">Админ-панель</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">Пользователи, события, воронка и состояние сервиса.</p>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" data-no-swipe="true">
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

        {isLoading ? <div className="app-card text-sm text-white/50">Загрузка…</div> : null}
        {Object.values(errors).some(Boolean) ? (
          <div className="app-card border-red-400/20 bg-red-500/10 text-sm text-red-100">
            {errors.overview ? <div>Обзор: {errors.overview}</div> : null}
            {errors.users ? <div>Пользователи: {errors.users}</div> : null}
            {errors.events ? <div>События: {errors.events}</div> : null}
          </div>
        ) : null}

        {tab === 'overview' && overview ? (
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
        ) : null}

        {tab === 'users' ? (
          <section className="space-y-3">
            {users.map((item) => (
              <div key={item.id} className="app-card p-4">
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
                <div className="mt-3 text-xs text-white/38">Создан: {formatDate(item.createdAt)} · активность: {formatDate(item.lastActiveAt)}</div>

                <div className="mt-3 rounded-[20px] border border-white/8 bg-black/18 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white/80">Доступ</div>
                      <div className="mt-1 text-[11px] text-white/40">Premium: {item.subscription?.premiumLifetime ? 'навсегда' : formatSubscriptionDate(item.subscription?.premiumUntil)} · Business: {item.subscription?.businessLifetime ? 'навсегда' : formatSubscriptionDate(item.subscription?.businessUntil)}</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/70"
                      disabled={subscriptionBusy !== null}
                      onClick={() => handleRestartTrial(item.id)}
                    >
                      {subscriptionBusy === `${item.id}:trial` ? 'Включаю…' : 'Триал'}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={subscriptionDays[item.id] ?? '30'}
                      onChange={(event) => setSubscriptionDays((state) => ({ ...state, [item.id]: event.target.value }))}
                      inputMode="numeric"
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs text-white outline-none"
                    />
                    <span className="text-[11px] text-white/38">дней</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100" disabled={subscriptionBusy !== null} onClick={() => handleGrantSubscription(item.id, 'premium')}>Premium</button>
                    <button type="button" className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100" disabled={subscriptionBusy !== null} onClick={() => handleGrantSubscription(item.id, 'business')}>Business</button>
                    <button type="button" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100" disabled={subscriptionBusy !== null} onClick={() => handleGrantSubscription(item.id, 'premium', true)}>Premium навсегда</button>
                    <button type="button" className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100" disabled={subscriptionBusy !== null} onClick={() => handleGrantSubscription(item.id, 'business', true)}>Business навсегда</button>
                    <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/60" disabled={subscriptionBusy !== null} onClick={() => handleRevokeSubscription(item.id, 'premium')}>Снять Premium</button>
                    <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/60" disabled={subscriptionBusy !== null} onClick={() => handleRevokeSubscription(item.id, 'business')}>Снять Business</button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="block w-full rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-center text-xs font-bold text-white/88 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={resettingUserId !== null}
                    onClick={() => handleResetUser(item.id, 'finance')}
                  >
                    {resettingUserId === item.id + ':finance' ? 'Сбрасываю…' : 'Сбросить финансы'}
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-2xl border border-rose-300/25 bg-rose-500/10 px-3 py-2.5 text-center text-xs font-bold text-rose-100 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={resettingUserId !== null}
                    onClick={() => handleResetUser(item.id, 'full')}
                  >
                    {resettingUserId === item.id + ':full' ? 'Обнуляю…' : 'Обнулить всё'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {tab === 'events' ? (
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
        ) : null}


        {tab === 'training' ? (
          <section className="admin-ai-training space-y-3">
            <div className="app-card admin-ai-training__hero">
              <div>
                <div className="app-eyebrow">Разбор Фины</div>
                <h2>Ошибки и уточнения</h2>
                <p>Здесь собираются команды, где Фина ошиблась, попросила уточнение или подготовила действие на проверку.</p>
              </div>
              <button type="button" className="app-secondary-button" onClick={() => void loadTrainingExamples()} disabled={isTrainingLoading}>
                {isTrainingLoading ? 'Обновляю…' : 'Обновить'}
              </button>
            </div>

            {isTrainingLoading && !trainingExamples.length ? <div className="app-card text-sm text-white/50">Загрузка…</div> : null}

            {trainingExamples.length ? trainingExamples.map((item) => (
              <article key={item.id} className="app-card admin-ai-training__item">
                <div className="admin-ai-training__top">
                  <span className={item.success ? 'admin-ai-training__badge is-success' : 'admin-ai-training__badge is-warning'}>
                    {item.success ? 'Размечено' : 'Нужно проверить'}
                  </span>
                  <small>{formatDate(item.createdAt)}</small>
                </div>

                <div className="admin-ai-training__block">
                  <span>Команда</span>
                  <p>{item.input}</p>
                </div>

                {item.aiOutput ? (
                  <div className="admin-ai-training__block">
                    <span>Ответ Фины</span>
                    <pre>{item.aiOutput}</pre>
                  </div>
                ) : null}

                {item.error ? (
                  <div className="admin-ai-training__error">{item.error}</div>
                ) : null}

                <label className="admin-ai-training__editor">
                  <span>Как должно быть</span>
                  <textarea
                    value={trainingDrafts[item.id] ?? ''}
                    onChange={(event) => setTrainingDrafts((state) => ({ ...state, [item.id]: event.target.value }))}
                    rows={4}
                    placeholder="Коротко опиши правильное действие или ответ."
                  />
                </label>

                <div className="admin-ai-training__actions">
                  <button
                    type="button"
                    className="app-secondary-button"
                    disabled={trainingBusyId === item.id}
                    onClick={() => void handleSaveTrainingExample(item.id, false)}
                  >
                    Сохранить как ошибку
                  </button>
                  <button
                    type="button"
                    className="app-primary-button"
                    disabled={trainingBusyId === item.id}
                    onClick={() => void handleSaveTrainingExample(item.id, true)}
                  >
                    Отметить исправленным
                  </button>
                </div>
              </article>
            )) : (
              <div className="app-card text-sm text-white/50">Пока нет примеров для разбора.</div>
            )}
          </section>
        ) : null}

        {tab === 'tools' ? (
          <div className="space-y-4">
            <section className="app-card">
              <div className="app-section-title">Онбординг</div>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Открой первый мастер настройки заново, чтобы проверить путь нового пользователя.
              </p>
              <button
                type="button"
                className="app-primary-button mt-4 w-full"
                onClick={replayOnboarding}
              >
                Повторить онбординг
              </button>
            </section>

            <section className="app-card">
              <div className="app-section-title">Premium</div>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Включи Premium-вид на этом устройстве, чтобы проверить будущий опыт пользователя.
              </p>
              <button
                type="button"
                className={premiumPreviewEnabled ? 'app-secondary-button mt-4 w-full' : 'app-primary-button mt-4 w-full'}
                onClick={togglePremiumPreview}
              >
                {premiumPreviewEnabled ? 'Выключить Premium-вид' : 'Включить Premium-вид'}
              </button>
            </section>
          </div>
        ) : null}

        {tab === 'monitoring' && monitoring ? (
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
        ) : null}
      </div>
    </div>
  );
}
