import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { subscriptionApi, type SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type StoreCard = {
  eyebrow: I18nKey;
  title: I18nKey;
  caption: I18nKey;
  items: I18nKey[];
  action: I18nKey;
  tone: 'premium' | 'business' | 'referral';
};

const premiumItems: I18nKey[] = [
  'store.premium.item.analytics',
  'store.premium.item.reports',
  'store.premium.item.receipts',
  'store.premium.item.voice',
];

const businessItems: I18nKey[] = [
  'store.business.item.workspace',
  'store.business.item.reports',
  'store.business.item.premiumGift',
];

const referralItems: I18nKey[] = [
  'store.referral.item.invite',
  'store.referral.item.purchase',
  'store.referral.item.balance',
];

const cards: StoreCard[] = [
  {
    eyebrow: 'store.premium.eyebrow',
    title: 'store.premium.title',
    caption: 'store.premium.caption',
    items: premiumItems,
    action: 'store.action.soon',
    tone: 'premium',
  },
  {
    eyebrow: 'store.business.eyebrow',
    title: 'store.business.title',
    caption: 'store.business.caption',
    items: businessItems,
    action: 'store.action.business',
    tone: 'business',
  },
  {
    eyebrow: 'store.referral.eyebrow',
    title: 'store.referral.title',
    caption: 'store.referral.caption',
    items: referralItems,
    action: 'store.action.referral',
    tone: 'referral',
  },
];

function formatAccessDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long' }).format(date);
}

export default function PremiumPage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(user?.isAdmin);
  const name = useMemo(() => user?.firstName || user?.username || t('store.userFallback'), [t, user?.firstName, user?.username]);
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      setSubscription(await subscriptionApi.me());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscription();
  }, []);

  const startTrial = async () => {
    setTrialBusy(true);
    try {
      setSubscription(await subscriptionApi.startTrial());
    } finally {
      setTrialBusy(false);
    }
  };

  const access = subscription?.access;
  const statusText = access?.hasBusiness
    ? t('store.status.business')
    : access?.hasPremium
      ? t('store.status.premium')
      : t('store.status.free');
  const statusCaption = access?.businessLifetime || access?.premiumLifetime
    ? t('store.status.forever')
    : access?.businessUntil
      ? t('store.status.until', { date: formatAccessDate(access.businessUntil, '—') })
      : access?.premiumUntil
        ? t('store.status.until', { date: formatAccessDate(access.premiumUntil, '—') })
        : access?.trialUntil
          ? t('store.status.trialUntil', { date: formatAccessDate(access.trialUntil, '—') })
          : t('store.status.freeCaption');

  return (
    <div className="app-page premium-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.store')} left="back" right={['home', 'settings']} />

        <header className="premium-admin-hero store-hero">
          <div className="premium-admin-hero__glow" aria-hidden="true" />
          <div className="premium-admin-kicker">{t('store.hero.eyebrow')}</div>
          <h1>{t('store.hero.title', { name })}</h1>
          <p>{t('store.hero.caption')}</p>
          <div className="premium-admin-hero__actions">
            <button type="button" className="app-primary-button" onClick={() => navigateTo('referral')}>{t('store.action.referral')}</button>
            {isAdmin ? <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>{t('store.action.admin')}</button> : null}
          </div>
        </header>

        <section className="app-card premium-admin-section store-trial-card">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('store.status.eyebrow')}</div>
              <h2>{isLoading ? t('store.status.loading') : statusText}</h2>
            </div>
            <span>{subscription ? `${subscription.limits.voiceCommandsPerDay} ${t('store.status.voiceLimit')}` : '—'}</span>
          </div>
          <p>{statusCaption}</p>
        </section>

        <section className="store-card-grid">
          {cards.map((card) => (
            <article key={card.title} className={`store-card store-card--${card.tone}`}>
              <div className="app-eyebrow">{t(card.eyebrow)}</div>
              <h2>{t(card.title)}</h2>
              <p>{t(card.caption)}</p>
              <ul>
                {card.items.map((item) => <li key={item}>{t(item)}</li>)}
              </ul>
              <button type="button" className="app-secondary-button" onClick={() => card.tone === 'business' ? navigateTo('business-accountant') : card.tone === 'referral' ? navigateTo('referral') : undefined}>
                {t(card.action)}
              </button>
            </article>
          ))}
        </section>

        <section className="app-card premium-admin-section store-trial-card">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('store.trial.eyebrow')}</div>
              <h2>{t('store.trial.title')}</h2>
            </div>
            <span>{t('store.trial.badge')}</span>
          </div>
          <p>{t('store.trial.caption')}</p>
          <button
            type="button"
            className="app-primary-button mt-4 w-full"
            disabled={trialBusy || Boolean(subscription?.access.trialUsed)}
            onClick={startTrial}
          >
            {subscription?.access.trialUsed ? t('store.trial.used') : trialBusy ? t('store.trial.starting') : t('store.trial.action')}
          </button>
        </section>
      </div>
    </div>
  );
}
