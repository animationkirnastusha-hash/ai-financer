import { CompanionButton } from '@/shared/ui/CompanionButton';
import { useI18n } from '@/shared/lib/i18n';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';
import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';

export function WelcomeStep({
  name,
}: {
  name: string;
  draft: OnboardingDraft;
  onChange: (draft: OnboardingDraft) => void;
}) {
  const { t } = useI18n();

  return (
    <OnboardingStepShell
      eyebrow={t('onboarding.welcome.eyebrow')}
      title={t('onboarding.welcome.title', { name })}
      description={t('onboarding.welcome.description')}
    >
      <div className="onboarding-fina-hero onboarding-fina-hero--clear">
        <CompanionButton mood="success" size="lg" label="Фина" />
        <div>
          <strong>{t('onboarding.welcome.voiceTitle')}</strong>
          <span>{t('onboarding.welcome.voiceCaption')}</span>
        </div>
      </div>

      <div className="onboarding-flow" aria-label={t('onboarding.welcome.flowLabel')}>
        <div>
          <strong>1</strong>
          <span>{t('onboarding.welcome.flow.voice')}</span>
        </div>
        <div>
          <strong>2</strong>
          <span>{t('onboarding.welcome.flow.accounts')}</span>
        </div>
        <div>
          <strong>3</strong>
          <span>{t('onboarding.welcome.flow.setup')}</span>
        </div>
        <div>
          <strong>4</strong>
          <span>{t('onboarding.welcome.flow.finish')}</span>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
