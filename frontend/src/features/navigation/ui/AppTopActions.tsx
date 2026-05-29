import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';

const SCREENS_WITH_COMMANDS = new Set(['dashboard', 'transactions', 'analytics']);
const MAIN_SCREENS = new Set(['dashboard', 'transactions', 'analytics']);

const screenTitles: Record<string, string> = {
  dashboard: 'Главная',
  transactions: 'Операции',
  analytics: 'Аналитика',
  settings: 'Настройки',
};

export function AppTopActions() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openGlobalCommandList = useNavigationStore((state) => state.openGlobalCommandList);
  const isNotificationsOpen = useNavigationStore((state) => state.isNotificationsOpen);
  const openNotifications = useNavigationStore((state) => state.openNotifications);
  const closeNotifications = useNavigationStore((state) => state.closeNotifications);

  if (currentScreen === 'ai-core') return null;

  const showCommandButton = SCREENS_WITH_COMMANDS.has(currentScreen);
  const showMainLabel = MAIN_SCREENS.has(currentScreen);

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+76px)] z-[85] px-4"
      data-no-swipe="true"
    >
      <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          {showCommandButton ? (
            <button
              type="button"
              onClick={openGlobalCommandList}
              className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#050b10]/82 px-3 text-sm text-white/78 shadow-2xl"
              aria-label="Меню"
            >
              <span className="text-emerald-200">⌘</span>
              <span>Меню</span>
            </button>
          ) : null}
        </div>

        {showMainLabel ? (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">
              {screenTitles[currentScreen] ?? ''}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
          {currentScreen === 'settings' ? <LanguageSwitcher compact /> : null}

          <button
            type="button"
            onClick={() => navigateTo('transactions')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050b10]/82 text-base text-white/70 shadow-2xl"
            aria-label="История операций"
          >
            ◷
          </button>

          {currentScreen !== 'settings' ? (
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050b10]/82 text-lg text-emerald-100 shadow-2xl"
              aria-label="Настройки"
            >
              ⚙
            </button>
          ) : (
            <button
              type="button"
              onClick={isNotificationsOpen ? closeNotifications : openNotifications}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050b10]/82 text-base text-white/70 shadow-2xl"
              aria-label="Уведомления"
            >
              •
            </button>
          )}
        </div>
      </div>

      {isNotificationsOpen ? (
        <div className="pointer-events-auto mx-auto mt-3 max-w-[560px]">
          <div className="ml-auto w-[min(320px,calc(100vw-32px))] rounded-[26px] border border-white/10 bg-[#07111b]/96 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Уведомления</div>
                <div className="mt-1 text-xs leading-5 text-white/45">
                  Здесь появятся подтверждения и важные события.
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
              <div className="text-sm text-emerald-50">Пока всё спокойно</div>
              <div className="mt-1 text-xs leading-5 text-emerald-50/60">
                Если AI попросит подтверждение, оно появится здесь.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
