import { CompanionButton } from '@/shared/ui/CompanionButton';

type VoicePermissionIntroProps = {
  wakeName: string;
  isPriming: boolean;
  permissionState?: PermissionState | 'unsupported' | 'unknown';
  onPrime: () => void;
  onSkip: () => void;
};

export function VoicePermissionIntro({ wakeName, isPriming, permissionState = 'unknown', onPrime, onSkip }: VoicePermissionIntroProps) {
  const denied = permissionState === 'denied';
  const unsupported = permissionState === 'unsupported';

  return (
    <div className="voice-first-intro" data-no-swipe="true" role="dialog" aria-modal="true" aria-label="Разрешение микрофона">
      <div className="voice-first-intro__card voice-first-intro__card--polished">
        <div className="voice-first-intro__avatar" aria-hidden="true">
          <CompanionButton mood={denied ? 'warning' : 'idle'} size="md" label={wakeName} />
        </div>
        <div className="voice-first-intro__eyebrow">Голосовой ввод</div>
        <div className="voice-first-intro__title">{denied ? 'Микрофон заблокирован' : 'Разреши микрофон'}</div>

        {unsupported ? (
          <p>В этом браузере или WebView запись голоса недоступна. Используй текстовый ввод.</p>
        ) : denied ? (
          <p>Доступ к микрофону запрещён. Открой настройки Telegram или браузера, разреши микрофон для этого сайта и вернись в приложение.</p>
        ) : (
          <p>Нажми кнопку ниже и подтверди системный запрос. После этого запись будет начинаться только вручную.</p>
        )}

        <div className="voice-first-intro__steps">
          <div><b>1</b><span>Нажми “Разрешить микрофон”</span></div>
          <div><b>2</b><span>Подтверди системное окно</span></div>
          <div><b>3</b><span>Зажми Фину и говори команду</span></div>
        </div>

        <div className={denied ? 'voice-first-intro__hint voice-first-intro__hint--warning' : 'voice-first-intro__hint'}>
          Системный запрос появляется только после нажатия кнопки. Удержание Фины не будет запускать разрешение и не сломает запись.
        </div>

        <div className="voice-first-intro__actions">
          <button type="button" onClick={onPrime} disabled={isPriming || unsupported}>{isPriming ? 'Запрашиваю...' : denied ? 'Проверить снова' : 'Разрешить микрофон'}</button>
          <button type="button" onClick={onSkip}>Позже</button>
        </div>
      </div>
    </div>
  );
}
