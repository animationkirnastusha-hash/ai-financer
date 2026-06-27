import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type SettingsSection } from '@/features/navigation/model/navigation.store';
import { useLearningProgressStore, type LearningProgressStep } from '@/features/onboarding/model/learning-progress.store';
import { useReferralStore } from '@/features/referral/model/referral.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type ProfileTile = {
  title: string;
  caption: string;
  action: () => void;
  badge?: string;
};

type CommandExample = {
  labelKey: I18nKey;
  command: string;
  step?: LearningProgressStep;
};

function formatBonus(value: number) {
  if (!value) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value / 100);
}


export default function ProfilePage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openSettingsSection = useNavigationStore((state) => state.openSettingsSection);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const markLearning = useLearningProgressStore((state) => state.mark);
  const referral = useReferralStore((state) => state.info);
  const loadReferral = useReferralStore((state) => state.load);
  const [publicIdCopied, setPublicIdCopied] = useState(false);

  useEffect(() => {
    void loadReferral();
  }, [loadReferral]);

  const displayName = user?.firstName || user?.username || t('profile.user.fallback');
  const publicId = user?.publicId ?? '';

  const copyPublicId = async () => {
    if (!publicId) return;

    try {
      await navigator.clipboard.writeText(publicId);
      setPublicIdCopied(true);
      window.setTimeout(() => setPublicIdCopied(false), 1300);
    } catch {
      setPublicIdCopied(false);
    }
  };

  const commandGroups = useMemo(() => [
    {
      titleKey: 'profile.examples.group.money' as I18nKey,
      items: [
        { labelKey: 'profile.examples.expense' as I18nKey, command: 'Потратил на кофе', step: 'firstExpense' as LearningProgressStep },
        { labelKey: 'profile.examples.income' as I18nKey, command: 'Получил зарплату' },
      ] satisfies CommandExample[],
    },
    {
      titleKey: 'profile.examples.group.planning' as I18nKey,
      items: [
        { labelKey: 'profile.examples.goal' as I18nKey, command: 'Создай цель на отпуск', step: 'firstGoal' as LearningProgressStep },
        { labelKey: 'profile.examples.limit' as I18nKey, command: 'Поставь лимит на кафе', step: 'firstLimit' as LearningProgressStep },
      ] satisfies CommandExample[],
    },
    {
      titleKey: 'profile.examples.group.questions' as I18nKey,
      items: [
        { labelKey: 'profile.examples.today' as I18nKey, command: 'Сколько я потратил сегодня?', step: 'firstQuestion' as LearningProgressStep },
        { labelKey: 'profile.examples.balance' as I18nKey, command: 'Какой общий баланс?' },
      ] satisfies CommandExample[],
    },
  ], []);

  const settingsTiles = useMemo<ProfileTile[]>(() => {
    const openSettings = (section: SettingsSection) => () => openSettingsSection(section);
    return [
      { title: t('profile.tile.settings.title'), caption: t('profile.tile.settings.caption'), action: openSettings('fina') },
      { title: t('profile.tile.notifications.title'), caption: t('profile.tile.notifications.caption'), action: openSettings('notifications') },
      { title: t('profile.tile.data.title'), caption: t('profile.tile.data.caption'), action: openSettings('data') },
      { title: t('profile.tile.referral.title'), caption: t('profile.tile.referral.caption'), action: () => navigateTo('referral'), badge: String(referral?.referrals.length ?? 0) },
    ];
  }, [navigateTo, openSettingsSection, referral?.referrals.length, t]);

  const startExample = (example: CommandExample) => {
    if (example.step) markLearning(example.step);
    openAIWithCommand(example.command);
  };

  return (
    <div className="app-page profile-hub-page text-white">
      <div className="app-page__inner profile-hub">
        <ScreenTopBar title={t('screen.profile')} left="menu" right={['notifications', 'home']} />

        <header className="app-card app-card--hero profile-hub-hero">
          <div>
            <div className="app-eyebrow">{t('profile.hero.eyebrow')}</div>
            <h1>{displayName}</h1>
            <p>{t('profile.hero.caption')}</p>
            {publicId ? (
              <button type="button" className="profile-public-id" onClick={() => void copyPublicId()} aria-label={t('profile.publicId.copy')}>
                <span>{t('profile.publicId.label')}</span>
                <b>{publicId}</b>
                <small aria-hidden="true">{publicIdCopied ? '✓' : '⧉'}</small>
              </button>
            ) : null}
          </div>
          <div className="profile-hub-hero__stats">
            <article><span>{t('profile.friends')}</span><strong>{referral?.referrals.length ?? 0}</strong></article>
            <article><span>{t('profile.bonus')}</span><strong>{formatBonus(referral?.referralBalance ?? 0)}</strong></article>
          </div>
        </header>

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

        <section className="app-card profile-command-examples">
          <div>
            <div className="app-eyebrow">{t('profile.examples.eyebrow')}</div>
            <h2>{t('profile.examples.title')}</h2>
            <p>{t('profile.examples.caption')}</p>
          </div>
          <div className="profile-command-examples__groups">
            {commandGroups.map((group) => (
              <div key={group.titleKey} className="profile-command-examples__group">
                <strong>{t(group.titleKey)}</strong>
                <div className="profile-command-examples__chips">
                  {group.items.map((item) => (
                    <button key={item.labelKey} type="button" onClick={() => startExample(item)}>
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
