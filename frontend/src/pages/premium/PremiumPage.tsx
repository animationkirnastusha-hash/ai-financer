import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
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

type PremiumFeature = {
  title: I18nKey;
  caption: I18nKey;
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
    action: 'store.action.premium',
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

const premiumFeatures: PremiumFeature[] = [
  { title: 'store.features.forecast.title', caption: 'store.features.forecast.caption' },
  { title: 'store.features.reports.title', caption: 'store.features.reports.caption' },
  { title: 'store.features.receipts.title', caption: 'store.features.receipts.caption' },
  { title: 'store.features.voice.title', caption: 'store.features.voice.caption' },
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
  const openPremium = usePremiumStore((state) => state.openPremium);
  const isAdmin = Boolean(user?.isAdmin);
  const name = useMemo(() => user?.firstName || user?.username || t('store.userFallback'), [t, user?.firstName, user?.username]);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const startTrial = useSubscriptionStore((state) => state.startTrial);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const handleStartTrial = async () => {
    await startTrial();
  };

  const access = subscription?.access;
  const hasPremium = Boolean(access?.hasPremium);
  const hasBusiness = Boolean(access?.hasBusiness);
  const statusText = hasBusiness
    ? t('store.status.business')
    : hasPremium
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

  const handleCardClick = (card: StoreCard) => {
    if (card.tone === 'referral') {
      navigateTo('referral');
      return;
    }

    if (card.tone === 'business') {
      if (hasBusiness || isAdmin) {
        navigateTo('business-accountant');
        return;
      }

      openPremium({
        kind: 'deep_analysis',
        title: t('store.business.locked.title'),
        description: t('store.business.locked.caption'),
        cta: t('store.action.premium'),
      });
      return;
    }

    openPremium({
      kind: 'deep_analysis',
      title: t(card.title),
      description: t(card.caption),
      cta: t(card.action),
    });
  };

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
            <button type="button" className="app-primary-button" onClick={() => handleCardClick(cards[0])}>{t('store.action.premium')}</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('referral')}>{t('store.action.referral')}</button>
            {isAdmin ? <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>{t('store.action.admin')}</button> : null}
          </div>
        </header>

        <section className="app-card premium-admin-section store-status-card">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('store.status.eyebrow')}</div>
              <h2>{isLoading ? t('store.status.loading') : statusText}</h2>
            </div>
            <span className={hasBusiness || hasPremium ? 'store-active-badge' : undefined}>
              {hasBusiness || hasPremium ? t('store.status.active') : subscription ? `${subscription.limits.voiceCommandsPerDay} ${t('store.status.voiceLimit')}` : '—'}
            </span>
          </div>
          <p>{statusCaption}</p>
        </section>

        {subscription?.usage ? (
          <section className="app-card premium-admin-section store-usage-card">
            <div className="premium-admin-section__head">
              <div>
                <div className="app-eyebrow">{t('store.usage.eyebrow')}</div>
                <h2>{t('store.usage.title')}</h2>
              </div>
              <span>{t('store.usage.today')}</span>
            </div>
            <div className="store-usage-grid">
              <div>
                <strong>{subscription.usage.voiceCommandsToday.remaining}</strong>
                <span>{t('store.usage.voiceLeft', { limit: subscription.usage.voiceCommandsToday.limit })}</span>
              </div>
              <div>
                <strong>{subscription.usage.receiptScansThisMonth.remaining}</strong>
                <span>{t('store.usage.receiptsLeft', { limit: subscription.usage.receiptScansThisMonth.limit })}</span>
              </div>
              <div>
                <strong>{subscription.usage.advancedReportsThisMonth.remaining}</strong>
                <span>{t('store.usage.reportsLeft', { limit: subscription.usage.advancedReportsThisMonth.limit })}</span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="store-card-grid">
          {cards.map((card) => {
            const active = card.tone === 'premium' ? hasPremium : card.tone === 'business' ? hasBusiness : false;
            return (
              <article key={card.title} className={`store-card store-card--${card.tone}`}>
                <button type="button" className="store-card__button" onClick={() => handleCardClick(card)} aria-label={t(card.title)}>
                  <div className="store-card__head">
                    <div className="app-eyebrow">{t(card.eyebrow)}</div>
                    {active ? <span>{t('store.status.active')}</span> : null}
                  </div>
                  <h2>{t(card.title)}</h2>
                  <p>{t(card.caption)}</p>
                  <ul>
                    {card.items.map((item) => <li key={item}>{t(item)}</li>)}
                  </ul>
                  <span className="store-card__action">{t(card.action)}</span>
                </button>
              </article>
            );
          })}
        </section>

        <section className="app-card premium-admin-section store-feature-section">
          <div className="premium-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('store.features.eyebrow')}</div>
              <h2>{t('store.features.title')}</h2>
            </div>
            <span>{t('store.features.badge')}</span>
          </div>
          <div className="store-feature-grid">
            {premiumFeatures.map((feature) => (
              <button
                type="button"
                key={feature.title}
                className="store-feature-card"
                onClick={() => openPremium({
                  kind: 'locked_insight',
                  title: t(feature.title),
                  description: t(feature.caption),
                  cta: t('store.action.premium'),
                })}
              >
                <strong>{t(feature.title)}</strong>
                <span>{t(feature.caption)}</span>
              </button>
            ))}
          </div>
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
            disabled={isLoading || Boolean(subscription?.access.trialUsed)}
            onClick={handleStartTrial}
          >
            {subscription?.access.trialUsed ? t('store.trial.used') : isLoading ? t('store.trial.starting') : t('store.trial.action')}
          </button>
        </section>
      </div>
    </div>
  );
}
