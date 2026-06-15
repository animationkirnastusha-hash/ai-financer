import { useI18n } from '@/shared/lib/i18n';
import { CompanionButton } from '@/shared/ui/CompanionButton';

type VoicePermissionIntroProps = {
  wakeName: string;
  isPriming: boolean;
  permissionState?: PermissionState | 'unsupported' | 'unknown';
  onPrime: () => void;
  onSkip: () => void;
};

export function VoicePermissionIntro({ wakeName, isPriming, permissionState = 'unknown', onPrime, onSkip }: VoicePermissionIntroProps) {
  const { t } = useI18n();
  const denied = permissionState === 'denied';
  const unsupported = permissionState === 'unsupported';

  return (
    <div className="voice-first-intro" data-no-swipe="true" role="dialog" aria-modal="true" aria-label={t('voiceIntro.aria')}>
      <div className="voice-first-intro__card voice-first-intro__card--polished">
        <div className="voice-first-intro__avatar" aria-hidden="true">
          <CompanionButton mood={denied ? 'warning' : 'idle'} size="md" label={wakeName} />
        </div>
        <div className="voice-first-intro__eyebrow">{t('voiceIntro.eyebrow')}</div>
        <div className="voice-first-intro__title">{denied ? t('voiceIntro.title.denied') : t('voiceIntro.title')}</div>

        {unsupported ? (
          <p>{t('voiceIntro.unsupported')}</p>
        ) : denied ? (
          <p>{t('voiceIntro.denied')}</p>
        ) : (
          <p>{t('voiceIntro.caption')}</p>
        )}

        <div className={denied ? 'voice-first-intro__hint voice-first-intro__hint--warning' : 'voice-first-intro__hint'}>
          {t('voiceIntro.hint')}
        </div>

        <div className="voice-first-intro__actions">
          <button type="button" onClick={onPrime} disabled={isPriming || unsupported}>{isPriming ? t('voiceIntro.action.loading') : denied ? t('voiceIntro.action.retry') : t('voiceIntro.action.allow')}</button>
          <button type="button" onClick={onSkip}>{t('voiceIntro.action.later')}</button>
        </div>
      </div>
    </div>
  );
}
