import { useEffect, useState } from 'react';
import { readMicrophonePermissionState, requestOnboardingMicrophonePermission } from '@/features/onboarding/model/microphonePermission';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';
import { useSettingsStore } from '@/features/settings/model/settings.store';

function permissionLabel(state: PermissionState | 'unsupported' | 'unknown') {
  if (state === 'granted') return 'Микрофон разрешён';
  if (state === 'denied') return 'Микрофон заблокирован';
  if (state === 'unsupported') return 'Микрофон недоступен';
  return 'Разрешение ещё не выдано';
}

export function MicrophonePermissionStep() {
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unsupported' | 'unknown'>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);

    const result = await requestOnboardingMicrophonePermission();
    setPermissionState(result.state);

    if (result.ok) {
      setMessage('Готово. Теперь на шаге со счетами можно зажать Фину и создать наличку с картой голосом.');
    } else if (result.state === 'denied') {
      setMessage('Доступ заблокирован. Открой настройки Telegram или браузера, разреши микрофон для этого сайта и вернись в приложение.');
    } else if (result.state === 'unsupported') {
      setMessage('В этом браузере или WebView микрофон недоступен. Можно пройти настройку вручную.');
    } else {
      setMessage('Системное окно не подтвердило доступ. Нажми кнопку ещё раз или продолжи вручную.');
    }

    setIsRequesting(false);
  };

  const isReady = voicePermissionPrompted || permissionState === 'granted';

  return (
    <OnboardingStepShell
      eyebrow="Микрофон"
      title="Сначала разрешим голос"
      description="Следующий практический шаг — создать Наличку и Карту голосом. Чтобы системное окно не сорвало запись во время удержания Фины, разрешение нужно выдать заранее."
    >
      <div className={isReady ? 'onboarding-permission-card is-ready' : 'onboarding-permission-card'}>
        <div className="onboarding-permission-card__icon" aria-hidden="true">🎙</div>
        <div>
          <strong>{permissionLabel(permissionState)}</strong>
          <span>
            {isReady
              ? 'Можно переходить дальше: запись будет начинаться только когда ты зажмёшь Фину.'
              : 'Нажми кнопку ниже и подтверди системный запрос. Запись после разрешения сама не начнётся.'}
          </span>
        </div>
      </div>

      <button
        type="button"
        className={isReady ? 'app-secondary-button onboarding-wide-action' : 'app-primary-button onboarding-wide-action'}
        onClick={requestPermission}
        disabled={isRequesting || permissionState === 'unsupported'}
      >
        {isRequesting ? 'Запрашиваю…' : isReady ? 'Проверить разрешение ещё раз' : 'Разрешить микрофон'}
      </button>

      {message ? <div className={isReady ? 'onboarding-tip-card onboarding-tip-card--success' : 'onboarding-tip-card onboarding-tip-card--warning'}><span>{message}</span></div> : null}

      <div className="onboarding-rule-list">
        <div>
          <strong>Разрешение — отдельно</strong>
          <span>Сейчас мы только включаем доступ к микрофону. Команда не отправится сама.</span>
        </div>
        <div>
          <strong>Запись — на следующем шаге</strong>
          <span>На шаге “Счета” ты зажмёшь Фину и сам скажешь команды для создания налички и карты.</span>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
