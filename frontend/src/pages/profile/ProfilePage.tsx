import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { useNavigationStore, type SettingsSection } from '@/features/navigation/model/navigation.store';
import { useReferralStore } from '@/features/referral/model/referral.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type ProfileTile = {
  title: string;
  caption: string;
  action: () => void;
  badge?: string;
};

function formatBonus(value: number) {
  if (!value) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value / 100);
}

function formatPlan(status?: string | null) {
  if (status === 'business') return 'Business';
  if (status === 'premium') return 'Premium';
  if (status === 'trial') return 'Trial';
  return 'Free';
}

export default function ProfilePage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openSettingsSection = useNavigationStore((state) => state.openSettingsSection);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const referral = useReferralStore((state) => state.info);
  const loadReferral = useReferralStore((state) => state.load);

  useEffect(() => {
    void Promise.allSettled([loadSubscription(), loadReferral()]);
  }, [loadReferral, loadSubscription]);

  const plan = formatPlan(subscription?.access?.status);
  const displayName = user?.firstName || user?.username || t('profile.user.fallback');

  const settingsTiles = useMemo<ProfileTile[]>(() => {
    const openSettings = (section: SettingsSection) => () => openSettingsSection(section);
    return [
      { title: t('profile.tile.accounts.title'), caption: t('profile.tile.accounts.caption'), action: () => navigateTo('accounts') },
      { title: t('profile.tile.journal.title'), caption: t('profile.tile.journal.caption'), action: () => navigateTo('journal') },
      { title: t('profile.tile.settings.title'), caption: t('profile.tile.settings.caption'), action: openSettings('fina') },
      { title: t('profile.tile.notifications.title'), caption: t('profile.tile.notifications.caption'), action: openSettings('notifications') },
      { title: t('profile.tile.data.title'), caption: t('profile.tile.data.caption'), action: openSettings('data') },
      { title: t('profile.tile.referral.title'), caption: t('profile.tile.referral.caption'), action: () => navigateTo('referral'), badge: String(referral?.referrals.length ?? 0) },
      { title: t('profile.tile.store.title'), caption: t('profile.tile.store.caption'), action: () => navigateTo('store'), badge: plan },
    ];
  }, [navigateTo, openSettingsSection, plan, referral?.referrals.length, t]);

  return (
    <div className="app-page profile-hub-page text-white">
      <div className="app-page__inner profile-hub">
        <ScreenTopBar title={t('screen.profile')} left="menu" right={['notifications', 'home']} />

        <header className="app-card app-card--hero profile-hub-hero">
          <div>
            <div className="app-eyebrow">{t('profile.hero.eyebrow')}</div>
            <h1>{displayName}</h1>
            <p>{t('profile.hero.caption')}</p>
          </div>
          <div className="profile-hub-hero__stats">
            <article><span>{t('profile.plan')}</span><strong>{plan}</strong></article>
            <article><span>{t('profile.friends')}</span><strong>{referral?.referrals.length ?? 0}</strong></article>
            <article><span>{t('profile.bonus')}</span><strong>{formatBonus(subscription?.referralBalance ?? referral?.referralBalance ?? 0)}</strong></article>
          </div>
        </header>

        <FinaCommandBar
          titleKey="profile.command.title"
          captionKey="profile.command.caption"
          placeholderKey="profile.command.placeholder"
          suggestions={[
            { key: 'profile.command.export', command: 'экспортируй операции за месяц' },
            { key: 'profile.command.voice', command: 'открой настройки голоса' },
            { key: 'profile.command.usage', command: 'покажи статус подписки' },
          ]}
        />

        <section className="profile-hub-grid">
          {settingsTiles.map((tile) => (
            <button key={tile.title} type="button" className="app-card profile-hub-tile" onClick={tile.action}>
              <span>
                <b>{tile.title}</b>
                <small>{tile.caption}</small>
              </span>
              {tile.badge ? <em>{tile.badge}</em> : null}
            </button>
          ))}
        </section>

        <section className="app-card profile-hub-support">
          <div>
            <div className="app-eyebrow">{t('profile.support.eyebrow')}</div>
            <h2>{t('profile.support.title')}</h2>
            <p>{t('profile.support.caption')}</p>
          </div>
          <button type="button" className="app-secondary-button" onClick={() => openAIWithCommand('что умеет Фина')}>{t('profile.support.action')}</button>
        </section>
      </div>
    </div>
  );
}
