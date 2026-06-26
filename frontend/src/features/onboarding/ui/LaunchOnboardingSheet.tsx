import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useI18n } from '@/shared/lib/i18n';
import type { AppLanguage } from '@/features/settings/model/settings.types';

export function LaunchOnboardingSheet() {
  const { t } = useI18n();
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const complete = useOnboardingStore((state) => state.complete);
  const syncUserLocale = useAuthStore((state) => state.syncUserLocale);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setAppLanguage = useSettingsStore((state) => state.setAppLanguage);
  const openFirstRunChatSetup = useNavigationStore((state) => state.openFirstRunChatSetup);

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('ai-any-modal-open', 'ai-onboarding-active');
    document.documentElement.classList.add('ai-any-modal-open', 'ai-onboarding-active');

    return () => {
      document.body.classList.remove('ai-any-modal-open', 'ai-onboarding-active');
      document.documentElement.classList.remove('ai-any-modal-open', 'ai-onboarding-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const chooseLanguage = (language: AppLanguage) => {
    setAppLanguage(language);
    void syncUserLocale(language);
  };

  const start = () => {
    complete();
    window.setTimeout(() => openFirstRunChatSetup(), 0);
  };

  return (
    <div className="onboarding-entry" role="dialog" aria-modal="true" aria-label={t('onboarding.entry.aria')} data-no-swipe="true">
      <div className="onboarding-entry__ambient" aria-hidden="true" />

      <main className="onboarding-entry__card" data-no-swipe="true">
        <header className="onboarding-entry__top">
          <div className="onboarding-entry__brand" aria-hidden="true">
            <span>F</span>
          </div>

          <div className="onboarding-entry__language" role="group" aria-label={t('onboarding.language.aria')}>
            {(['en', 'ru'] as AppLanguage[]).map((language) => (
              <button
                key={language}
                type="button"
                className={appLanguage === language ? 'is-active' : ''}
                onClick={() => chooseLanguage(language)}
                aria-pressed={appLanguage === language}
              >
                {t(language === 'en' ? 'onboarding.language.enShort' : 'onboarding.language.ruShort')}
              </button>
            ))}
          </div>
        </header>

        <section className="onboarding-entry__hero">
          <div className="onboarding-entry__orb" aria-hidden="true">✦</div>
          <h1>{t('onboarding.entry.title')}</h1>
          <p>{t('onboarding.entry.caption')}</p>
        </section>

        <footer className="onboarding-entry__footer">
          <button type="button" className="onboarding-entry__start" onClick={start}>
            {t('onboarding.entry.start')}
          </button>
        </footer>
      </main>
    </div>
  );
}
