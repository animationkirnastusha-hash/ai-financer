import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

export function PremiumTrialStep({ isAdmin }: { isAdmin: boolean }) {
  return (
    <OnboardingStepShell
      eyebrow="Premium"
      title={isAdmin ? 'Premium и trial' : 'Бесплатно достаточно для старта'}
      description={isAdmin
        ? 'Этот экран пока виден админу как прототип будущей продажи trial и подписки.'
        : 'Базовые финансы можно вести бесплатно. Premium усилит аналитику, отчёты и разбор чеков.'}
    >
      <div className="onboarding-premium-card">
        <div>
          <span>7 дней trial</span>
          <strong>Попробовать расширенный режим</strong>
          <small>Глубокий анализ, красивые отчёты, фото чеков и будущие банковские интеграции.</small>
        </div>
        <div className="onboarding-premium-card__badge">Скоро</div>
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
