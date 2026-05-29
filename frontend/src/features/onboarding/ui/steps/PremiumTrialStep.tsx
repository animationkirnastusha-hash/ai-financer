import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

export function PremiumTrialStep({ isAdmin }: { isAdmin: boolean }) {
  return (
    <OnboardingStepShell
      eyebrow="Premium"
      title={isAdmin ? 'Premium и пробный период' : 'Бесплатно достаточно для старта'}
      description={isAdmin
        ? 'Покажем, как будет выглядеть пробный период и подписка.'
        : 'Базовые финансы можно вести бесплатно. Premium усилит аналитику, отчёты и работу с чеками.'}
    >
      <div className="onboarding-premium-card">
        <div>
          <span>7 дней бесплатно</span>
          <strong>Попробовать расширенный режим</strong>
          <small>Глубокий анализ, красивые отчёты, фото чеков и банковские интеграции.</small>
        </div>
        <div className="onboarding-premium-card__badge">Premium</div>
      </div>

      <div className="onboarding-feature-list">
        <span>Фото чека</span>
        <span>Расширенные отчёты</span>
        <span>Советы по кредитам</span>
        <span>Фина Бухгалтер</span>
      </div>
    </OnboardingStepShell>
  );
}
