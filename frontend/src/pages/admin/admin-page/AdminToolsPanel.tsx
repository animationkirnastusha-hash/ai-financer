type Props = {
  onReplayOnboarding: () => void;
};

export function AdminToolsPanel({ onReplayOnboarding }: Props) {
  return (
    <div className="admin-tools-panel">
      <section className="app-card admin-tools-card">
        <div>
          <div className="app-eyebrow">Онбординг</div>
          <h2>Проверка первого запуска</h2>
          <p>Открой первый мастер настройки заново, чтобы проверить путь нового пользователя.</p>
        </div>
        <button
          type="button"
          className="app-primary-button"
          onClick={onReplayOnboarding}
        >
          Повторить онбординг
        </button>
      </section>
    </div>
  );
}
