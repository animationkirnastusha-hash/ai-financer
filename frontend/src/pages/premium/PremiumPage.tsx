import { useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type PremiumFeature = {
  title: string;
  caption: string;
  status: 'available' | 'soon' | 'payment';
};

const heroFeatures: PremiumFeature[] = [
  {
    title: 'Глубокий финансовый анализ',
    caption: 'Фина объясняет, где деньги утекают, какие привычки повторяются и где можно снизить нагрузку.',
    status: 'soon',
  },
  {
    title: 'Фото чека',
    caption: 'Сфотографировал чек — Фина разложила товары, суммы и категории перед подтверждением.',
    status: 'soon',
  },
  {
    title: 'Красивые отчёты PDF / Excel',
    caption: 'Отчёт за период с таблицей, категориями, графиками и коротким выводом Фины.',
    status: 'soon',
  },
  {
    title: 'Банковские интеграции',
    caption: 'Подключение карт и автоматическая загрузка операций в безопасном режиме чтения.',
    status: 'soon',
  },
  {
    title: 'Фина Бухгалтер',
    caption: 'Отдельный Business-модуль для ИП, самозанятых и малого бизнеса.',
    status: 'available',
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
  'Банковские интеграции',
  'Business-модуль как отдельный тариф поверх Premium',
];

const trialSteps = [
  '7 дней бесплатно один раз на пользователя',
  'После пробного периода — мягкое предложение купить месяц',
  'Оплата: Telegram Stars, крипта, СБП или карта',
];

const foundationItems = [
  'Статус подписки',
  'Пробный период',
  'Premium-возможности',
  'Лимиты голосовых команд',
  'Выдача Premium из админки',
  'Реферальные награды',
];

function StatusBadge({ status }: { status: PremiumFeature['status'] }) {
  const label = status === 'available' ? 'готово' : status === 'payment' ? 'оплата' : 'скоро';
  return <span className={`premium-admin-badge premium-admin-badge--${status}`}>{label}</span>;
}

function AdminOnlyFallback() {
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Магазин" left="back" right={['home']} />
        <section className="app-card app-card--hero">
          <div className="app-eyebrow">Скоро</div>
          <h1 className="app-hero-title">Premium готовится</h1>
          <p className="app-hero-caption">Сейчас можно пользоваться базовой версией без ограничений для основных финансовых действий.</p>
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
        <ScreenTopBar title="Магазин" left="back" right={['home', 'settings']} />

        <header className="premium-admin-hero">
          <div className="premium-admin-hero__glow" aria-hidden="true" />
          <div className="premium-admin-kicker">Store</div>
          <h1>Магазин возможностей</h1>
          <p>
            {adminName}, здесь собирается Premium и Business: больше анализа, меньше ручной работы и больше полезных подсказок по деньгам.
          </p>
          <div className="premium-admin-hero__actions">
            <button type="button" className="app-primary-button" onClick={() => navigateTo('business-accountant')}>ИИ-бухгалтер</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('referral')}>Рефералы</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>Админка</button>
          </div>
        </header>

        <section className="premium-admin-plan-grid">
          <article className="premium-admin-plan-card premium-admin-plan-card--free">
            <div className="premium-admin-plan-card__label">Free</div>
            <h2>База остаётся полезной</h2>
            <p>Free должен помогать вести деньги каждый день, а не выглядеть искусственно урезанным.</p>
            <ul>
              {freeItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <article className="premium-admin-plan-card premium-admin-plan-card--premium">
            <div className="premium-admin-plan-card__label">Premium</div>
            <h2>Больше глубины и экономии времени</h2>
            <p>Premium усиливает пользователя прогнозами, автоматизацией и более точными советами Фины.</p>
            <ul>
              {premiumItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </section>

        <section className="app-card premium-admin-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">Возможности</div>
              <h2>Что будет отличать Premium</h2>
            </div>
            <span>приоритет</span>
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
              <div className="app-eyebrow">Пробный период</div>
              <h2>7 дней бесплатно</h2>
            </div>
            <span>для первого знакомства</span>
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
            <div className="app-eyebrow">Business</div>
            <h2>Фина Бухгалтер</h2>
            <p>Отдельное направление для самозанятых, ИП и малого бизнеса. Личные и бизнес-деньги не смешиваются.</p>
          </div>
          <button type="button" className="app-primary-button" onClick={() => navigateTo('business-accountant')}>Посмотреть</button>
        </section>

        <section className="app-card premium-admin-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">Основа</div>
              <h2>Что нужно для полноценного Premium</h2>
            </div>
          </div>
          <div className="premium-admin-roadmap">
            {foundationItems.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}
