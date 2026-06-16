import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useI18n } from '@/shared/lib/i18n';

function getFirstName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.firstName || user?.username || '';
}

const ONBOARDING_CHAT_COMMAND = 'Привет, я новый пользователь. Познакомь меня с Финой коротко, объясни что можно писать или говорить голосом, и помоги спокойно начать с первого счёта.';

export function LaunchOnboardingSheet() {
  const { t } = useI18n();
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const complete = useOnboardingStore((state) => state.complete);
  const skip = useOnboardingStore((state) => state.skip);
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);

  const name = useMemo(() => getFirstName(user), [user]);

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

  const continueInChat = () => {
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => {
      openModal({
        type: 'ai-text-overlay',
        initialCommand: ONBOARDING_CHAT_COMMAND,
        autoSubmitInitialCommand: true,
      });
    }, 120);
  };

  const skipOnboarding = () => {
    skip();
    navigateTo('dashboard');
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true">
      <div className="app-modal-sheet onboarding-setup-sheet onboarding-setup-sheet--compact" data-no-swipe="true">
        <div className="app-modal-handle" />

        <div className="app-modal-body onboarding-setup-body onboarding-setup-body--compact">
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
        </div>

        <footer className="app-modal-footer onboarding-setup-footer onboarding-setup-footer--compact">
          <button type="button" className="app-secondary-button" onClick={skipOnboarding}>
            {t('onboarding.action.later')}
          </button>
          <button type="button" className="app-primary-button" onClick={continueInChat}>
            {t('onboarding.action.continueChat')}
          </button>
        </footer>
      </div>
    </div>
  );
}
