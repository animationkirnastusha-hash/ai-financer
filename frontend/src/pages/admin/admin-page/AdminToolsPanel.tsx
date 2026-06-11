type Props = {
  premiumPreviewEnabled: boolean;
  onReplayOnboarding: () => void;
  onTogglePremiumPreview: () => void;
};

export function AdminToolsPanel({ premiumPreviewEnabled, onReplayOnboarding, onTogglePremiumPreview }: Props) {
  return (
    <div className="space-y-4">
      <section className="app-card">
        <div className="app-section-title">Онбординг</div>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Открой первый мастер настройки заново, чтобы проверить путь нового пользователя.
        </p>
        <button
          type="button"
          className="app-primary-button mt-4 w-full"
          onClick={onReplayOnboarding}
        >
          Повторить онбординг
        </button>
      </section>

      <section className="app-card">
        <div className="app-section-title">Premium</div>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Включи Premium-вид на этом устройстве, чтобы проверить будущий опыт пользователя.
        </p>
        <button
          type="button"
          className={premiumPreviewEnabled ? 'app-secondary-button mt-4 w-full' : 'app-primary-button mt-4 w-full'}
          onClick={onTogglePremiumPreview}
        >
          {premiumPreviewEnabled ? 'Выключить Premium-вид' : 'Включить Premium-вид'}
        </button>
      </section>
    </div>
  );
}
