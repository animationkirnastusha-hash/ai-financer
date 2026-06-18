import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useI18n } from '@/shared/lib/i18n';
import type { AppLanguage } from '@/features/settings/model/settings.types';

function getFirstName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.firstName || user?.username || '';
}

const ONBOARDING_CHAT_MESSAGE_KEY = 'onboarding.chatStart.assistantMessage';

export function LaunchOnboardingSheet() {
  const { t } = useI18n();
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const complete = useOnboardingStore((state) => state.complete);
  const user = useAuthStore((state) => state.user);
  const syncUserLocale = useAuthStore((state) => state.syncUserLocale);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setAppLanguage = useSettingsStore((state) => state.setAppLanguage);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);

  const name = useMemo(() => getFirstName(user), [user]);
  const shouldShowLanguageChoice = !user?.locale;

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    document.body.classList.add('ai-onboarding-active');
    document.documentElement.classList.add('ai-onboarding-active');
    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
      document.body.classList.remove('ai-onboarding-active');
      document.documentElement.classList.remove('ai-onboarding-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const chooseLanguage = (language: AppLanguage) => {
    setAppLanguage(language);
    void syncUserLocale(language);
  };

  const continueInChat = () => {
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => {
      openModal({
        type: 'ai-text-overlay',
        initialAssistantMessage: t(ONBOARDING_CHAT_MESSAGE_KEY),
      });
    }, 120);
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true">
      <div className="app-modal-sheet onboarding-setup-sheet onboarding-setup-sheet--compact" data-no-swipe="true">
        <div className="app-modal-handle" />

        <div className="app-modal-body onboarding-setup-body onboarding-setup-body--compact">

          {shouldShowLanguageChoice ? (
            <section className="onboarding-language-card" aria-label={t('onboarding.language.aria')}>
              <div>
                <strong>{t('onboarding.language.title')}</strong>
                <span>{t('onboarding.language.caption')}</span>
              </div>
              <div className="onboarding-language-actions" role="group" aria-label={t('onboarding.language.aria')}>
                {(['en', 'ru'] as AppLanguage[]).map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={appLanguage === language ? 'is-active' : ''}
                    onClick={() => chooseLanguage(language)}
                  >
                    {t(language === 'en' ? 'onboarding.language.en' : 'onboarding.language.ru')}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="onboarding-welcome-card">
            <div className="onboarding-fina-mark" aria-hidden="true">✦</div>
            <div className="app-eyebrow">{t('onboarding.welcome.eyebrow')}</div>
            <h2>{t(name ? 'onboarding.welcome.titleWithName' : 'onboarding.welcome.title', { name })}</h2>
            <p>{t('onboarding.welcome.shortDescription')}</p>
          </section>

          <section className="onboarding-chat-start-card">
            <strong>{t('onboarding.chatStart.title')}</strong>
            <span>{t('onboarding.chatStart.caption')}</span>
          </section>

          <section className="onboarding-quick-rules" aria-label={t('onboarding.quick.aria')}>
            <div>
              <strong>{t('onboarding.quick.text.title')}</strong>
              <span>{t('onboarding.quick.text.caption')}</span>
            </div>
            <div>
              <strong>{t('onboarding.quick.voice.title')}</strong>
              <span>{t('onboarding.quick.voice.caption')}</span>
            </div>
            <div>
              <strong>{t('onboarding.quick.account.title')}</strong>
              <span>{t('onboarding.quick.account.caption')}</span>
            </div>
          </section>
        </div>

        <footer className="app-modal-footer onboarding-setup-footer onboarding-setup-footer--compact onboarding-setup-footer--single">
          <button type="button" className="app-primary-button" onClick={continueInChat}>
            {t('onboarding.action.continueChat')}
          </button>
        </footer>
      </div>
    </div>
  );
}
