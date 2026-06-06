import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type ProfileCard = {
  titleKey: string;
  captionKey: string;
  bulletKeys: string[];
};

type WorkZone = {
  titleKey: string;
  captionKey: string;
  state: 'available' | 'soon' | 'important';
};

const profileCards: ProfileCard[] = [
  {
    titleKey: 'business.profile.selfEmployed.title',
    captionKey: 'business.profile.selfEmployed.caption',
    bulletKeys: ['business.profile.selfEmployed.b1', 'business.profile.selfEmployed.b2', 'business.profile.selfEmployed.b3'],
  },
  {
    titleKey: 'business.profile.ip.title',
    captionKey: 'business.profile.ip.caption',
    bulletKeys: ['business.profile.ip.b1', 'business.profile.ip.b2', 'business.profile.ip.b3'],
  },
  {
    titleKey: 'business.profile.small.title',
    captionKey: 'business.profile.small.caption',
    bulletKeys: ['business.profile.small.b1', 'business.profile.small.b2', 'business.profile.small.b3'],
  },
];

const workZones: WorkZone[] = [
  { titleKey: 'business.zone.taxes.title', captionKey: 'business.zone.taxes.caption', state: 'soon' },
  { titleKey: 'business.zone.income.title', captionKey: 'business.zone.income.caption', state: 'soon' },
  { titleKey: 'business.zone.expense.title', captionKey: 'business.zone.expense.caption', state: 'soon' },
  { titleKey: 'business.zone.docs.title', captionKey: 'business.zone.docs.caption', state: 'soon' },
  { titleKey: 'business.zone.reports.title', captionKey: 'business.zone.reports.caption', state: 'available' },
  { titleKey: 'business.zone.safe.title', captionKey: 'business.zone.safe.caption', state: 'important' },
];

const accountingAreas = [
  'business.area.profile',
  'business.area.taxMode',
  'business.area.income',
  'business.area.expense',
  'business.area.reminders',
  'business.area.docs',
  'business.area.reports',
  'business.area.export',
];

function StateBadge({ state }: { state: WorkZone['state'] }) {
  const { t } = useI18n();
  const label = state === 'available' ? t('business.badge.available') : state === 'important' ? t('business.badge.important') : t('business.badge.soon');
  return <span className={`business-admin-badge business-admin-badge--${state}`}>{label}</span>;
}

function BusinessLockedFallback() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.business')} left="back" right={['home', 'store']} />
        <section className="app-card app-card--hero">
          <div className="app-eyebrow">{t('business.locked.eyebrow')}</div>
          <h1 className="app-hero-title">{t('business.locked.title')}</h1>
          <p className="app-hero-caption">{t('business.locked.caption')}</p>
          <button type="button" className="app-primary-button mt-4" onClick={() => navigateTo('store')}>{t('business.locked.action')}</button>
        </section>
      </div>
    </div>
  );
}

export default function BusinessAccountantPage() {
  const { t } = useI18n();
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const hasBusiness = Boolean(isAdmin || subscription?.access.hasBusiness);
  if (!hasBusiness) return <BusinessLockedFallback />;

  return (
    <div className="app-page business-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.business')} left="back" right={['home', 'settings']} />

        <header className="business-admin-hero business-admin-hero--access">
          <div className="business-admin-hero__orb" aria-hidden="true" />
          <div className="business-admin-kicker">{t('business.hero.eyebrow')}</div>
          <h1>{t('business.hero.title')}</h1>
          <p>{t('business.hero.caption')}</p>
          <div className="business-admin-hero__actions">
            <button type="button" className="app-primary-button" onClick={() => openModal({ type: 'report-export', mode: 'business' })}>{t('business.action.report')}</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('dashboard')}>{t('business.action.personal')}</button>
          </div>
        </header>

        <section className="business-report-card">
          <div className="app-eyebrow">{t('business.report.eyebrow')}</div>
          <h2>{t('business.report.title')}</h2>
          <p>{t('business.report.caption')}</p>
          <div className="business-report-card__actions">
            <button type="button" className="app-primary-button" onClick={() => openModal({ type: 'report-export', mode: 'business' })}>{t('business.action.report')}</button>
            <button type="button" className="app-secondary-button" onClick={() => openModal({ type: 'report-export', mode: 'premium' })}>{t('business.action.advanced')}</button>
          </div>
        </section>

        <section className="business-admin-warning">
          <b>{t('business.position.title')}</b>
          <span>{t('business.position.caption')}</span>
        </section>

        <section className="business-admin-profile-grid">
          {profileCards.map((card) => (
            <article key={card.titleKey} className="business-admin-profile-card">
              <div className="business-admin-profile-card__icon">{t(card.titleKey).slice(0, 1)}</div>
              <h2>{t(card.titleKey)}</h2>
              <p>{t(card.captionKey)}</p>
              <div>
                {card.bulletKeys.map((bullet) => <span key={bullet}>{t(bullet)}</span>)}
              </div>
            </article>
          ))}
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('business.modules.eyebrow')}</div>
              <h2>{t('business.modules.title')}</h2>
            </div>
            <span>{t('business.modules.badge')}</span>
          </div>
          <div className="business-admin-zone-list">
            {workZones.map((zone) => (
              <article key={zone.titleKey} className="business-admin-zone-card">
                <div>
                  <h3>{t(zone.titleKey)}</h3>
                  <p>{t(zone.captionKey)}</p>
                </div>
                <StateBadge state={zone.state} />
              </article>
            ))}
          </div>
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('business.flow.eyebrow')}</div>
              <h2>{t('business.flow.title')}</h2>
            </div>
          </div>
          <div className="business-admin-flow">
            <div><strong>1</strong><span>{t('business.flow.step1')}</span></div>
            <div><strong>2</strong><span>{t('business.flow.step2')}</span></div>
            <div><strong>3</strong><span>{t('business.flow.step3')}</span></div>
          </div>
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">{t('business.areas.eyebrow')}</div>
              <h2>{t('business.areas.title')}</h2>
            </div>
          </div>
          <div className="business-admin-roadmap">
            {accountingAreas.map((item) => <span key={item}>{t(item)}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}
