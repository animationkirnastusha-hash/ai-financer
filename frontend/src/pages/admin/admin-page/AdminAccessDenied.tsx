import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export function AdminAccessDenied() {
  return (
    <div className="app-page admin-page text-white">
      <div className="app-page__inner admin-layout">
        <ScreenTopBar title="Админ" left="back" right={['home']} />
        <div className="app-card admin-denied-card">
          <div className="app-eyebrow">Закрытый раздел</div>
          <h1>Недоступно</h1>
          <p>Этот раздел скрыт для обычных пользователей.</p>
        </div>
      </div>
    </div>
  );
}
