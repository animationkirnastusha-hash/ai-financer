import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { requestOnboardingMicrophonePermission } from '@/features/onboarding/model/microphonePermission';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useLearningProgressStore, type LearningProgressStep } from '@/features/onboarding/model/learning-progress.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type LearningTask = {
  id: LearningProgressStep;
  titleKey: I18nKey;
  captionKey: I18nKey;
  command: string;
};

const learningTasks: LearningTask[] = [
  {
    id: 'firstExpense',
    titleKey: 'onboarding.learning.expense.title',
    captionKey: 'onboarding.learning.expense.caption',
    command: 'Потратил на кофе',
  },
  {
    id: 'firstQuestion',
    titleKey: 'onboarding.learning.question.title',
    captionKey: 'onboarding.learning.question.caption',
    command: 'Сколько я потратил сегодня?',
  },
  {
    id: 'firstLimit',
    titleKey: 'onboarding.learning.limit.title',
    captionKey: 'onboarding.learning.limit.caption',
    command: 'Поставь лимит на кафе',
  },
  {
    id: 'firstGoal',
    titleKey: 'onboarding.learning.goal.title',
    captionKey: 'onboarding.learning.goal.caption',
    command: 'Создай цель на отпуск',
  },
];

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
  const markLearning = useLearningProgressStore((state) => state.mark);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micMessageKey, setMicMessageKey] = useState<I18nKey | null>(null);

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

  const closeAndOpenDashboard = () => {
    complete();
    navigateTo('dashboard');
  };

  const startWithCommand = (task: LearningTask) => {
    markLearning(task.id);
    complete();
    navigateTo('dashboard');
    window.setTimeout(() => {
      openModal({
        type: 'ai-text-overlay',
        initialCommand: task.command,
        autoSubmitInitialCommand: true,
      });
    }, 120);
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

          <section className="onboarding-learning-card">
            <div className="onboarding-learning-card__head">
              <span>{t('onboarding.learning.eyebrow')}</span>
              <strong>{t('onboarding.learning.title')}</strong>
            </div>
            <div className="onboarding-learning-list">
              {learningTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="onboarding-learning-task"
                  onClick={() => startWithCommand(task)}
                >
                  <span>{t(task.titleKey)}</span>
                  <small>{t(task.captionKey)}</small>
                </button>
              ))}
            </div>
          </section>

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
          <button type="button" className="app-primary-button" onClick={closeAndOpenDashboard}>
            {t('onboarding.action.start')}
          </button>
        </footer>
      </div>
    </div>
  );
}
