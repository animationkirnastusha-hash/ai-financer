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
        <div className="voice-first-intro__title">Разреши микрофон заранее</div>
        <p>
          Так запись не сломается при первом удержании. После разрешения запись стартует только от твоего действия.
        </p>

        <div className="voice-first-intro__steps">
          <div><b>1</b><span>Нажми «Разрешить»</span></div>
          <div><b>2</b><span>Зажми Фину и говори</span></div>
          <div><b>3</b><span>Отпусти или закрепи запись</span></div>
        </div>

        <div className="voice-first-intro__hint">
          В закреплённой записи нажми на Фину, чтобы отправить. Кнопка отмены остаётся отдельно снизу.
        </div>

        <div className="voice-first-intro__actions">
          <button type="button" onClick={onPrime} disabled={isPriming}>{isPriming ? 'Запрашиваю...' : 'Разрешить микрофон'}</button>
          <button type="button" onClick={onSkip}>Позже</button>
        </div>
      </div>
    </div>
  );
}
