import { useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type PremiumFeature = {
  title: string;
  caption: string;
  status: 'ready-ui' | 'backend-later' | 'payments-later';
};

const heroFeatures: PremiumFeature[] = [
  {
    title: 'Глубокий финансовый анализ',
    caption: 'Фина объясняет, где деньги утекают, какие привычки повторяются и где можно снизить нагрузку.',
    status: 'backend-later',
  },
  {
    title: 'Фото чека',
    caption: 'Сфотографировал чек — Фина разложила товары, суммы и категории перед подтверждением.',
    status: 'backend-later',
  },
  {
    title: 'Красивые отчёты PDF / Excel',
    caption: 'Отчёт за период с таблицей, категориями, графиками и коротким выводом Фины.',
    status: 'backend-later',
  },
  {
    title: 'Банковские интеграции',
    caption: 'Подключение карт и автоматическая загрузка операций в режиме read-only.',
    status: 'backend-later',
  },
  {
    title: 'Фина Бухгалтер',
    caption: 'Отдельный Business-модуль для ИП, самозанятых и малого бизнеса. Не смешиваем с личными финансами.',
    status: 'ready-ui',
  },
];

const freeItems = [
  'Текстовый ввод финансовых операций без жёсткого лимита',
  'Голосовой ввод до 50 успешных команд в день',
  'Счета, категории, разделы, цели и базовая аналитика',
  'Кредиты, ипотека и напоминания как базовая функция',
  'Обычный экспорт операций',
];

const premiumItems = [
  'Расширенный голосовой лимит',
  'Глубокая аналитика и прогнозы',
  'Умные советы по кредитам и досрочному погашению',
  'Фото чеков и красивый разбор покупок',
  'Банковские интеграции после отдельного backend-этапа',
  'Business-модуль как отдельный тариф поверх Premium',
];

const trialSteps = [
  '7 дней бесплатно один раз на пользователя',
  'После trial — мягкое предложение купить месяц',
  'Оплаты позже: Telegram Stars, крипта, СБП/карты',
];

function StatusBadge({ status }: { status: PremiumFeature['status'] }) {
  const label = status === 'ready-ui' ? 'готово в UI' : status === 'payments-later' ? 'позже оплата' : 'backend позже';
  return <span className={`premium-admin-badge premium-admin-badge--${status}`}>{label}</span>;
}

function AdminOnlyFallback() {
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Премиум" left="back" right={['home']} />
        <section className="app-card app-card--hero">
          <div className="app-eyebrow">Скоро</div>
          <h1 className="app-hero-title">Раздел готовится</h1>
          <p className="app-hero-caption">Premium пока скрыт для тестеров, чтобы не мешать проверке базовой версии.</p>
          <button type="button" className="app-primary-button mt-4" onClick={goHome}>На главную</button>
        </section>
      </div>
    </div>
  );
}

export default function PremiumPage() {
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(user?.isAdmin);

  const adminName = useMemo(() => user?.firstName || user?.username || 'админ', [user?.firstName, user?.username]);

  if (!isAdmin) return <AdminOnlyFallback />;

  return (
    <div className="app-page premium-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Premium" left="back" right={['home', 'settings']} />

        <header className="premium-admin-hero">
          <div className="premium-admin-hero__glow" aria-hidden="true" />
          <div className="premium-admin-kicker">Admin-only прототип</div>
          <h1>Premium должен ощущаться как Фина на уровень выше</h1>
          <p>
            Сейчас экран видит только {adminName}. Для тестеров базовая версия остаётся чистой: без paywall, рекламы и новых ограничений.
          </p>
          <div className="premium-admin-hero__actions">
            <button type="button" className="app-primary-button" onClick={() => navigateTo('business-accountant')}>ИИ-бухгалтер</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('referral')}>Рефералка</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>Админка</button>
          </div>
        </header>

        <section className="premium-admin-plan-grid">
          <article className="premium-admin-plan-card premium-admin-plan-card--free">
            <div className="premium-admin-plan-card__label">Free</div>
            <h2>База остаётся полезной</h2>
            <p>Нельзя делать Free бесполезным. Пользователь должен вести деньги даже без подписки.</p>
            <ul>
              {freeItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <article className="premium-admin-plan-card premium-admin-plan-card--premium">
            <div className="premium-admin-plan-card__label">Premium</div>
            <h2>Больше глубины и экономии времени</h2>
            <p>Premium продаёт не блокировки, а более умные выводы, автоматизацию и доверие к картине денег.</p>
            <ul>
              {premiumItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </section>

        <section className="app-card premium-admin-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">Ключевые фичи</div>
              <h2>Что показываем в Premium-дизайне</h2>
            </div>
            <span>UI готовим сейчас</span>
          </div>
          <div className="premium-admin-feature-list">
            {heroFeatures.map((feature) => (
              <article key={feature.title} className="premium-admin-feature-card">
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.caption}</p>
                </div>
                <StatusBadge status={feature.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="app-card premium-admin-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">Trial</div>
              <h2>7 дней бесплатно</h2>
            </div>
            <span>без оплаты пока</span>
          </div>
          <div className="premium-admin-trial-card">
            {trialSteps.map((item, index) => (
              <div key={item}>
                <strong>{index + 1}</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>


        <section className="premium-business-teaser">
          <div>
            <div className="app-eyebrow">Отдельный тариф позже</div>
            <h2>Фина Бухгалтер</h2>
            <p>Business-направление для самозанятых, ИП и малого бизнеса. Это не просто Premium-фича, а отдельный рабочий режим поверх личных финансов.</p>
          </div>
          <button type="button" className="app-primary-button" onClick={() => navigateTo('business-accountant')}>Посмотреть</button>
        </section>

        <section className="app-card premium-admin-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">Backend позже</div>
              <h2>Что подключаем следующим этапом</h2>
            </div>
          </div>
          <div className="premium-admin-roadmap">
            <span>Subscription model</span>
            <span>Trial status</span>
            <span>Feature flags</span>
            <span>Usage limits</span>
            <span>Admin grant Premium</span>
            <span>Referral rewards</span>
          </div>
        </section>
      </div>
    </div>
  );
}
