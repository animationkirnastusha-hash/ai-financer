import { CompanionButton } from '@/shared/ui/CompanionButton';

type VoicePermissionIntroProps = {
  wakeName: string;
  isPriming: boolean;
  onPrime: () => void;
  onSkip: () => void;
};

export function VoicePermissionIntro({ wakeName, isPriming, onPrime, onSkip }: VoicePermissionIntroProps) {
  return (
    <div className="voice-first-intro" data-no-swipe="true">
      <div className="voice-first-intro__card voice-first-intro__card--polished">
        <div className="voice-first-intro__avatar" aria-hidden="true">
          <CompanionButton mood="idle" size="md" label={wakeName} />
        </div>
        <div className="voice-first-intro__eyebrow">Голосовой ввод</div>
        <div className="voice-first-intro__title">Разреши микрофон</div>
        <p>Микрофон нужен для голосовых команд. Запись начинается только когда ты зажимаешь Фину.</p>

        <div className="voice-first-intro__steps">
          <div><b>1</b><span>Разреши доступ один раз</span></div>
          <div><b>2</b><span>Зажми Фину и говори</span></div>
          <div><b>3</b><span>Отпусти, чтобы отправить</span></div>
        </div>

        <div className="voice-first-intro__hint">
          Можно потянуть вверх, чтобы закрепить запись, или влево, чтобы отменить.
        </div>

        <div className="voice-first-intro__actions">
          <button type="button" onClick={onPrime} disabled={isPriming}>{isPriming ? 'Запрашиваю...' : 'Разрешить микрофон'}</button>
          <button type="button" onClick={onSkip}>Позже</button>
        </div>
      </div>
    </div>
  );
}
