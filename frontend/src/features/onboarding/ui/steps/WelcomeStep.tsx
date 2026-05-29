import { CompanionButton } from '@/shared/ui/CompanionButton';
import { OnboardingStepShell, OnboardingChoice } from '@/features/onboarding/ui/OnboardingStepShell';
import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';

export function WelcomeStep({
  name,
  draft,
  onChange,
}: {
  name: string;
  draft: OnboardingDraft;
  onChange: (draft: OnboardingDraft) => void;
}) {
  return (
    <OnboardingStepShell
      eyebrow="Первый запуск"
      title={`Привет, ${name}`}
      description="Я Фина — персональный финансовый ассистент. Давай быстро настроим приложение, чтобы оно сразу работало под твои деньги."
    >
      <div className="onboarding-fina-hero">
        <CompanionButton mood="success" size="lg" label="Фина" />
        <div>
          <strong>Настройка займёт пару минут</strong>
          <span>Счета, валюта, цели, напоминания и голосовой ввод. Всё можно пропустить и изменить позже.</span>
        </div>
      </div>

      <div className="onboarding-choice-grid">
        <OnboardingChoice
          active={draft.focus === 'personal'}
          title="Личные финансы"
          caption="Расходы, доходы, счета и цели"
          onClick={() => onChange({ ...draft, focus: 'personal' })}
        />
        <OnboardingChoice
          active={draft.focus === 'saving'}
          title="Накопления"
          caption="Цели, подушка и контроль лишних трат"
          onClick={() => onChange({ ...draft, focus: 'saving' })}
        />
        <OnboardingChoice
          active={draft.focus === 'debt'}
          title="Кредиты"
          caption="Платежи, напоминания и снижение нагрузки"
          onClick={() => onChange({ ...draft, focus: 'debt' })}
        />
        <OnboardingChoice
          active={draft.focus === 'business'}
          title="Самозанятый / ИП"
          caption="Позже подключим Фину Бухгалтер"
          onClick={() => onChange({ ...draft, focus: 'business' })}
        />
      </div>
    </OnboardingStepShell>
  );
}
