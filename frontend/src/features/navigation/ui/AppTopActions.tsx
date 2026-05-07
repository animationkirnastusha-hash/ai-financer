import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export function AppTopActions() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const hasSystemNotifications = useNavigationStore(
    (state) => state.hasSystemNotifications,
  );
  const isNotificationsOpen = useNavigationStore((state) => state.isNotificationsOpen);
  const openNotifications = useNavigationStore((state) => state.openNotifications);
  const closeNotifications = useNavigationStore((state) => state.closeNotifications);

  if (currentScreen === 'settings' || currentScreen === 'taxonomy-settings') {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed right-4 top-[calc(env(safe-area-inset-top)+18px)] z-[85]"
      data-no-swipe="true"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openNotifications}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-lg text-white/80 shadow-2xl backdrop-blur-xl"
          aria-label="Уведомления системы"
        >
          🔔
          {hasSystemNotifications ? (
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => navigateTo('settings')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-xl text-emerald-100 shadow-2xl backdrop-blur-xl"
          aria-label="Настройки"
        >
          ⚙
        </button>
      </div>

      {isNotificationsOpen ? (
        <div className="absolute right-0 mt-3 w-[min(320px,calc(100vw-32px))] rounded-[26px] border border-white/10 bg-[#07111b]/95 p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Системные уведомления</div>
              <div className="mt-1 text-xs leading-5 text-white/45">
                Здесь будут важные события: подтверждения AI, ошибки синхронизации,
                напоминания и советы по базе.
              </div>
            </div>

            <button
              type="button"
              onClick={closeNotifications}
              className="rounded-full border border-white/10 bg-white/6 px-2 py-1 text-xs text-white/55"
            >
              ×
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-300/12 bg-emerald-300/8 p-3">
            <div className="text-sm text-emerald-50">Base почти собран</div>
            <div className="mt-1 text-xs leading-5 text-emerald-50/60">
              Проверь счета, разделы, категории и AI-команды. Все найденные баги будем
              закрывать перед Premium.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
