type Props = {
  onReplayOnboarding: () => void;
};

export function AdminToolsPanel({ onReplayOnboarding }: Props) {
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
    </div>
  );
}
