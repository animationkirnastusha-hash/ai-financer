import { useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type StoreCard = {
  eyebrow: I18nKey;
  title: I18nKey;
  caption: I18nKey;
  items: I18nKey[];
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
    tone: 'premium',
  },
  {
    eyebrow: 'store.business.eyebrow',
    title: 'store.business.title',
    caption: 'store.business.caption',
    items: businessItems,
    tone: 'business',
  },
  {
    eyebrow: 'store.referral.eyebrow',
    title: 'store.referral.title',
    caption: 'store.referral.caption',
    items: referralItems,
    tone: 'referral',
  },
];

export default function PremiumPage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(user?.isAdmin);
  const name = useMemo(() => user?.firstName || user?.username || t('store.userFallback'), [t, user?.firstName, user?.username]);

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

        <section className="store-card-grid">
          {cards.map((card) => (
            <article key={card.title} className={`store-card store-card--${card.tone}`}>
              <div className="app-eyebrow">{t(card.eyebrow)}</div>
              <h2>{t(card.title)}</h2>
              <p>{t(card.caption)}</p>
              <ul>
                {card.items.map((item) => <li key={item}>{t(item)}</li>)}
              </ul>
              <button type="button" className="app-secondary-button" onClick={() => card.tone === 'business' ? navigateTo('business-accountant') : navigateTo('referral')}>
                {card.tone === 'business' ? t('store.action.business') : card.tone === 'referral' ? t('store.action.referral') : t('store.action.soon')}
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
        </section>
      </div>
    </div>
  );
}
