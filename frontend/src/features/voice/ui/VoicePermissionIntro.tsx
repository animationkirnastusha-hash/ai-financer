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
        <div className="voice-first-intro__eyebrow">Голосовой помощник</div>
        <div className="voice-first-intro__title">Это {wakeName}</div>
        <p>Разреши микрофон один раз. Дальше говори имя помощника и команду обычными словами.</p>

        <div className="voice-first-intro__steps">
          <div><b>1</b><span>Разреши микрофон</span></div>
          <div><b>2</b><span>Скажи «{wakeName}»</span></div>
          <div><b>3</b><span>Продиктуй команду</span></div>
        </div>

        <div className="voice-first-intro__hint">
          Например: “{wakeName}, кофе 300” или “{wakeName}, положи 10 тысяч на карту Т-Банк”.
        </div>

        <div className="voice-first-intro__actions">
          <button type="button" onClick={onPrime} disabled={isPriming}>{isPriming ? 'Запрашиваю...' : 'Разрешить микрофон'}</button>
          <button type="button" onClick={onSkip}>Позже</button>
        </div>
      </div>
    </div>
  );
}
