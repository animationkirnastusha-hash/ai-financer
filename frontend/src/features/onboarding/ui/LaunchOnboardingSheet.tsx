import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { goalsApi } from '@/features/goals/api/goals.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { AccountsStep } from '@/features/onboarding/ui/steps/AccountsStep';
import { CurrencyStep } from '@/features/onboarding/ui/steps/CurrencyStep';
import { FinishStep } from '@/features/onboarding/ui/steps/FinishStep';
import { GoalsStep } from '@/features/onboarding/ui/steps/GoalsStep';
import { LoansStep } from '@/features/onboarding/ui/steps/LoansStep';
import { MicrophonePermissionStep } from '@/features/onboarding/ui/steps/MicrophonePermissionStep';
import { RemindersStep } from '@/features/onboarding/ui/steps/RemindersStep';
import { VoiceIntroStep } from '@/features/onboarding/ui/steps/VoiceIntroStep';
import { WelcomeStep } from '@/features/onboarding/ui/steps/WelcomeStep';
import { useSettingsStore } from '@/features/settings/model/settings.store';

type StepId =
  | 'welcome'
  | 'microphone'
  | 'voice_intro'
  | 'currency'
  | 'accounts'
  | 'loans'
  | 'goals'
  | 'reminders'
  | 'finish';

const steps: Array<{ id: StepId; title: string }> = [
  { id: 'welcome', title: 'Старт' },
  { id: 'microphone', title: 'Микрофон' },
  { id: 'voice_intro', title: 'Фина' },
  { id: 'currency', title: 'Валюта' },
  { id: 'accounts', title: 'Счета' },
  { id: 'loans', title: 'Кредиты' },
  { id: 'goals', title: 'Цели' },
  { id: 'reminders', title: 'Напоминания' },
  { id: 'finish', title: 'Готово' },
];

function normalizeAccountCurrency(currency: OnboardingDraft['currency']): 'RUB' | 'USD' | 'EUR' {
  if (currency === 'USD' || currency === 'EUR') return currency;
  return 'RUB';
}

function getFirstName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.firstName || user?.username || 'друг';
}

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const draft = useOnboardingStore((state) => state.draft);
  const setDraft = useOnboardingStore((state) => state.setDraft);
  const skip = useOnboardingStore((state) => state.skip);
  const complete = useOnboardingStore((state) => state.complete);

  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const createAccount = useAccountsStore((state) => state.createAccount);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);

  const [stepIndex, setStepIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);

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

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    const isAccountVoiceStep = isOpen && currentStep.id === 'accounts' && (draft.accountsSetupMode ?? 'voice') === 'voice';
    if (!isAccountVoiceStep) {
      document.body.classList.remove('ai-onboarding-account-voice-step');
      document.documentElement.classList.remove('ai-onboarding-account-voice-step');
      return;
    }

    document.body.classList.add('ai-onboarding-account-voice-step');
    document.documentElement.classList.add('ai-onboarding-account-voice-step');

    return () => {
      document.body.classList.remove('ai-onboarding-account-voice-step');
      document.documentElement.classList.remove('ai-onboarding-account-voice-step');
    };
  }, [currentStep.id, draft.accountsSetupMode, isOpen]);

  if (!isOpen) return null;

  const updateDraft = (nextDraft: OnboardingDraft) => {
    setDraft(nextDraft);
  };

  const goNext = () => {
    setFinishError(null);
    if (isLastStep) {
      void finishSetup();
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  const goBack = () => {
    setFinishError(null);
    setStepIndex((value) => Math.max(value - 1, 0));
  };

  const finishSetup = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setFinishError(null);

    try {
      setMainCurrency(draft.currency);
      setVoiceEnabled(draft.voice.voiceEnabled);
      setTextInputEnabled(draft.voice.textFallbackEnabled);

      const accountCurrency = normalizeAccountCurrency(draft.currency);
      if (draft.accountsSetupMode === 'manual') {
        for (const account of draft.accounts) {
          if (!account.enabled || !account.name.trim()) continue;
          await createAccount({
            name: account.name.trim(),
            type: account.type,
            currency: accountCurrency,
            initialBalance: Number(account.balance) || 0,
          });
        }
      }

      if (draft.goal.enabled && draft.goal.title.trim() && Number(draft.goal.targetAmount) > 0) {
        await goalsApi.create({
          title: draft.goal.title.trim(),
          targetAmount: Number(draft.goal.targetAmount) || 0,
          currentAmount: 0,
          currency: accountCurrency,
          note: 'Создано при первом запуске',
        });
      }

      await loadAccounts(true);
      complete();
      navigateTo('dashboard');
    } catch (error) {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : 'Не удалось завершить настройку');
    } finally {
      setIsFinishing(false);
    }
  };

  const skipOnboarding = () => {
    skip();
    navigateTo('dashboard');
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true" data-ai-core-modal="true">
      <div className="app-modal-sheet onboarding-setup-sheet" data-no-swipe="true" data-ai-core-modal="true">
        <div className="app-modal-handle" />

        <header className="onboarding-setup-head">
          <div>
            <span>{currentStep.title}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="onboarding-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="onboarding-step-tabs" aria-label="Шаги настройки">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={index === stepIndex ? 'is-active' : ''}
                onClick={() => setStepIndex(index)}
                aria-label={step.title}
              />
            ))}
          </div>
        </header>

        <div className="app-modal-body onboarding-setup-body">
          {currentStep.id === 'welcome' ? <WelcomeStep name={getFirstName(user)} draft={draft} onChange={updateDraft} /> : null}
          {currentStep.id === 'microphone' ? <MicrophonePermissionStep /> : null}
          {currentStep.id === 'voice_intro' ? <VoiceIntroStep /> : null}
          {currentStep.id === 'currency' ? <CurrencyStep value={draft.currency} onChange={(currency) => updateDraft({ ...draft, currency })} /> : null}
          {currentStep.id === 'accounts' ? <AccountsStep draft={draft} onChange={updateDraft} /> : null}
          {currentStep.id === 'loans' ? <LoansStep draft={draft} onChange={updateDraft} /> : null}
          {currentStep.id === 'goals' ? <GoalsStep draft={draft} onChange={updateDraft} /> : null}
          {currentStep.id === 'reminders' ? <RemindersStep draft={draft} onChange={updateDraft} /> : null}
          {currentStep.id === 'finish' ? <FinishStep draft={draft} /> : null}

          {finishError ? <div className="app-error-box">{finishError}</div> : null}
        </div>

        <footer className="app-modal-footer onboarding-setup-footer">
          <button type="button" className="app-secondary-button" onClick={skipOnboarding} disabled={isFinishing}>
            Пропустить
          </button>
          <div className="onboarding-footer-actions">
            <button type="button" className="app-secondary-button" onClick={goBack} disabled={stepIndex === 0 || isFinishing}>
              Назад
            </button>
            <button type="button" className="app-primary-button" onClick={goNext} disabled={isFinishing}>
              {isFinishing ? 'Сохраняю…' : isLastStep ? 'Завершить' : 'Дальше'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
