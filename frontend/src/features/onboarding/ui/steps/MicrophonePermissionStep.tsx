import { useEffect, useState } from 'react';
import { readMicrophonePermissionState, requestOnboardingMicrophonePermission } from '@/features/onboarding/model/microphonePermission';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

function getPermissionLabelKey(state: PermissionState | 'unsupported' | 'unknown'): I18nKey {
  if (state === 'granted') return 'onboarding.microphone.status.granted';
  if (state === 'denied') return 'onboarding.microphone.status.denied';
  if (state === 'unsupported') return 'onboarding.microphone.status.unsupported';
  return 'onboarding.microphone.status.unknown';
}

export function MicrophonePermissionStep() {
  const { t } = useI18n();
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unsupported' | 'unknown'>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [messageKey, setMessageKey] = useState<I18nKey | null>(null);

  useEffect(() => {
    let alive = true;
    void readMicrophonePermissionState().then((state) => {
      if (!alive) return;
      setPermissionState(state);
      if (state === 'granted') setVoicePermissionPrompted(true);
      if (state === 'denied') setVoicePermissionPrompted(false);
    });
    return () => {
      alive = false;
    };
  }, [setVoicePermissionPrompted]);

  const requestPermission = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setMessageKey(null);

    const result = await requestOnboardingMicrophonePermission();
    setPermissionState(result.state);

    if (result.ok) {
      setMessageKey('onboarding.microphone.message.ready');
    } else if (result.state === 'denied') {
      setMessageKey('onboarding.microphone.message.denied');
    } else if (result.state === 'unsupported') {
      setMessageKey('onboarding.microphone.message.unsupported');
    } else {
      setMessageKey('onboarding.microphone.message.retry');
    }

    setIsRequesting(false);
  };

  const isReady = voicePermissionPrompted || permissionState === 'granted';

  return (
    <OnboardingStepShell
      eyebrow={t('onboarding.microphone.eyebrow')}
      title={t('onboarding.microphone.title')}
      description={t('onboarding.microphone.description')}
    >
      <div className={isReady ? 'onboarding-permission-card is-ready' : 'onboarding-permission-card'}>
        <div className="onboarding-permission-card__icon" aria-hidden="true">🎙</div>
        <div>
          <strong>{t(getPermissionLabelKey(permissionState))}</strong>
          <span>{isReady ? t('onboarding.microphone.readyCaption') : t('onboarding.microphone.waitingCaption')}</span>
        </div>
      </div>

      <button
        type="button"
        className={isReady ? 'app-secondary-button onboarding-wide-action' : 'app-primary-button onboarding-wide-action'}
        onClick={requestPermission}
        disabled={isRequesting || permissionState === 'unsupported'}
      >
        {isRequesting
          ? t('onboarding.microphone.action.loading')
          : isReady
            ? t('onboarding.microphone.action.retry')
            : t('onboarding.microphone.action.allow')}
      </button>

      {messageKey ? (
        <div className={isReady ? 'onboarding-tip-card onboarding-tip-card--success' : 'onboarding-tip-card onboarding-tip-card--warning'}>
          <span>{t(messageKey)}</span>
        </div>
      ) : null}

      <div className="onboarding-rule-list">
        <div>
          <strong>{t('onboarding.microphone.rule.permission.title')}</strong>
          <span>{t('onboarding.microphone.rule.permission.caption')}</span>
        </div>
        <div>
          <strong>{t('onboarding.microphone.rule.recording.title')}</strong>
          <span>{t('onboarding.microphone.rule.recording.caption')}</span>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
