import { CompanionButton } from '@/shared/ui/CompanionButton';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';
import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';

export function WelcomeStep({
  name,
}: {
  name: string;
  draft: OnboardingDraft;
  onChange: (draft: OnboardingDraft) => void;
}) {
  return (
    <OnboardingStepShell
      eyebrow="Первый запуск"
      title={`Привет, ${name}`}
      description="Я Фина — твой финансовый ассистент. Сейчас настроим приложение через реальные действия: создадим наличку и карту, выберем валюту, добавим цели, напоминания и покажем, как пользоваться голосом."
    >
      <div className="onboarding-fina-hero onboarding-fina-hero--clear">
        <CompanionButton mood="success" size="lg" label="Фина" />
        <div>
          <strong>Главное — сразу попробовать голос</strong>
          <span>На следующем шаге ты увидишь механику, а на шаге “Счета” зажмёшь Фину и создашь два первых счёта голосом.</span>
        </div>
      </div>

      <div className="onboarding-roadmap" aria-label="Что будет настроено">
        <div>
          <strong>1</strong>
          <span>Научимся зажимать Фину и говорить команду</span>
        </div>
        <div>
          <strong>2</strong>
          <span>Создадим Наличку и Карту голосом</span>
        </div>
        <div>
          <strong>3</strong>
          <span>Выберем валюту, цели и напоминания</span>
        </div>
        <div>
          <strong>4</strong>
          <span>Покажем Premium и будущего ИИ-бухгалтера</span>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
