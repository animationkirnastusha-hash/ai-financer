import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { requestOnboardingMicrophonePermission } from '@/features/onboarding/model/microphonePermission';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useProductTourStore } from '@/features/onboarding/model/productTour.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';

function getFirstName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.firstName || user?.username || '';
}

export function LaunchOnboardingSheet() {
  const { t } = useI18n();
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const complete = useOnboardingStore((state) => state.complete);
  const skip = useOnboardingStore((state) => state.skip);
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);
  const openTour = useProductTourStore((state) => state.open);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const startTrial = useSubscriptionStore((state) => state.startTrial);
  const isSubscriptionLoading = useSubscriptionStore((state) => state.isLoading);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micMessageKey, setMicMessageKey] = useState<string | null>(null);
  const [trialMessageKey, setTrialMessageKey] = useState<string | null>(null);

  const name = useMemo(() => getFirstName(user), [user]);
  const trialUsed = Boolean(subscription?.access?.trialUsed || subscription?.access?.hasPremium);
  const trialActive = Boolean(subscription?.access?.trialActive);

  useEffect(() => {
    if (!isOpen || subscription) return;
    void loadSubscription();
  }, [isOpen, loadSubscription, subscription]);

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

  const finishToDashboard = () => {
    complete();
    navigateTo('dashboard');
  };

  const openIntroChat = () => {
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => {
      openModal({
        type: 'ai-text-overlay',
        initialCommand: t('onboarding.introChat.command'),
        autoSubmitInitialCommand: true,
      });
    }, 140);
  };

  const openFirstAccount = () => {
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => {
      openModal({
        type: 'account-create',
        prefill: {
          name: t('onboarding.account.defaultName'),
          type: 'card',
          currency: 'RUB',
          initialBalance: '0',
        },
      });
    }, 140);
  };

  const startProductTour = () => {
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => openTour(), 720);
  };

  const skipOnboarding = () => {
    skip();
    navigateTo('dashboard');
  };

  const requestMic = async () => {
    if (isRequestingMic) return;
    setIsRequestingMic(true);
    setMicMessageKey(null);
    const result = await requestOnboardingMicrophonePermission();
    if (result.ok) setMicMessageKey('onboarding.microphone.message.readyShort');
    else if (result.state === 'denied') setMicMessageKey('onboarding.microphone.message.deniedShort');
    else setMicMessageKey('onboarding.microphone.message.laterShort');
    setIsRequestingMic(false);
  };

  const handleStartTrial = async () => {
    if (isSubscriptionLoading || trialUsed || trialActive) return;
    setTrialMessageKey(null);
    const status = await startTrial();
    if (status?.access?.trialActive) setTrialMessageKey('onboarding.trial.message.started');
    else setTrialMessageKey('onboarding.trial.message.unavailable');
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true">
      <div className="app-modal-sheet onboarding-setup-sheet onboarding-setup-sheet--compact" data-no-swipe="true">
        <div className="app-modal-handle" />

        <div className="app-modal-body onboarding-setup-body onboarding-setup-body--compact">
          <section className="onboarding-welcome-card onboarding-welcome-card--intro">
            <div className="onboarding-fina-mark" aria-hidden="true">✦</div>
            <div className="app-eyebrow">{t('onboarding.welcome.eyebrow')}</div>
            <h2>{t(name ? 'onboarding.welcome.titleWithName' : 'onboarding.welcome.title', { name })}</h2>
            <p>{t('onboarding.welcome.introDescription')}</p>
          </section>

          <section className="onboarding-intro-card">
            <div className="onboarding-intro-card__head">
              <span>{t('onboarding.intro.eyebrow')}</span>
              <strong>{t('onboarding.intro.title')}</strong>
            </div>
            <div className="onboarding-intro-list">
              <div><b>{t('onboarding.intro.free.title')}</b><small>{t('onboarding.intro.free.caption')}</small></div>
              <div><b>{t('onboarding.intro.premium.title')}</b><small>{t('onboarding.intro.premium.caption')}</small></div>
              <div><b>{t('onboarding.intro.business.title')}</b><small>{t('onboarding.intro.business.caption')}</small></div>
            </div>
          </section>

          <section className="onboarding-start-card">
            <button type="button" className="onboarding-start-action onboarding-start-action--primary" onClick={openIntroChat}>
              <span>{t('onboarding.start.chat.title')}</span>
              <small>{t('onboarding.start.chat.caption')}</small>
            </button>
            <button type="button" className="onboarding-start-action" onClick={openFirstAccount}>
              <span>{t('onboarding.start.account.title')}</span>
              <small>{t('onboarding.start.account.caption')}</small>
            </button>
            <button type="button" className="onboarding-start-action" onClick={startProductTour}>
              <span>{t('onboarding.start.tour.title')}</span>
              <small>{t('onboarding.start.tour.caption')}</small>
            </button>
          </section>

          <section className="onboarding-trial-card">
            <div>
              <strong>{trialActive ? t('onboarding.trial.activeTitle') : t('onboarding.trial.title')}</strong>
              <span>{trialUsed && !trialActive ? t('onboarding.trial.usedCaption') : t('onboarding.trial.caption')}</span>
            </div>
            <button
              type="button"
              className="app-secondary-button app-secondary-button--compact"
              onClick={handleStartTrial}
              disabled={isSubscriptionLoading || trialUsed || trialActive}
            >
              {trialActive ? t('onboarding.trial.action.active') : isSubscriptionLoading ? t('onboarding.trial.action.loading') : trialUsed ? t('onboarding.trial.action.used') : t('onboarding.trial.action.start')}
            </button>
          </section>
          {trialMessageKey ? <div className="app-info-box onboarding-info-box">{t(trialMessageKey)}</div> : null}

          <section className="onboarding-micro-card">
            <div>
              <strong>{t('onboarding.microphone.quickTitle')}</strong>
              <span>{voicePermissionPrompted ? t('onboarding.microphone.quickReady') : t('onboarding.microphone.quickCaption')}</span>
            </div>
            <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={requestMic} disabled={isRequestingMic || voicePermissionPrompted}>
              {isRequestingMic ? t('onboarding.microphone.action.loading') : voicePermissionPrompted ? t('onboarding.microphone.action.ready') : t('onboarding.microphone.action.allow')}
            </button>
          </section>
          {micMessageKey ? <div className="app-info-box onboarding-info-box">{t(micMessageKey)}</div> : null}
        </div>

        <footer className="app-modal-footer onboarding-setup-footer onboarding-setup-footer--compact">
          <button type="button" className="app-secondary-button" onClick={skipOnboarding}>
            {t('onboarding.action.later')}
          </button>
          <button type="button" className="app-primary-button" onClick={finishToDashboard}>
            {t('onboarding.action.start')}
          </button>
        </footer>
      </div>
    </div>
  );
}
