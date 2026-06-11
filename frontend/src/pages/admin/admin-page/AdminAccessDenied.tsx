import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export function AdminAccessDenied() {
  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Админ" left="back" right={['home']} />
        <div className="app-card">
          <div className="text-lg font-semibold">Недоступно</div>
          <div className="mt-2 text-sm text-white/50">Этот раздел скрыт для обычных пользователей.</div>
        </div>
      </div>
    </div>
  );
}
