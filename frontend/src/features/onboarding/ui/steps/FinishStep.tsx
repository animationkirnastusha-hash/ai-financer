import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

export function FinishStep({ draft }: { draft: OnboardingDraft }) {
  const enabledAccounts = draft.accounts.filter((account) => account.enabled);
  const accountsLabel = draft.accountsSetupMode === 'voice'
    ? 'Через голос'
    : draft.accountsSetupMode === 'manual'
      ? `${enabledAccounts.length}`
      : 'Позже';

  return (
    <OnboardingStepShell
      eyebrow="Готово"
      title="Можно начинать"
      description="Фина настроит окружение по выбранным пунктам. Всё можно изменить позже в настройках и на отдельных страницах."
    >
      <div className="onboarding-summary-grid">
        <div><span>Валюта</span><strong>{draft.currency}</strong></div>
        <div><span>Счета</span><strong>{accountsLabel}</strong></div>
        <div><span>Кредиты</span><strong>{draft.loan.enabled ? 'Добавить' : 'Позже'}</strong></div>
        <div><span>Цель</span><strong>{draft.goal.enabled ? draft.goal.title : 'Позже'}</strong></div>
        <div><span>Напоминания</span><strong>{draft.reminders.timing === 'off' ? 'Выкл' : 'Вкл'}</strong></div>
        <div><span>Голос</span><strong>{draft.voice.voiceEnabled ? 'Вкл' : 'Выкл'}</strong></div>
      </div>

      <div className="onboarding-tip-card">
        <strong>Первая команда после настройки</strong>
        <span>Зажми Фину и скажи: “кофе 300 с налички”.</span>
      </div>
    </OnboardingStepShell>
  );
}
