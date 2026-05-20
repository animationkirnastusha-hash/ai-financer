import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';

const SCREENS_WITH_COMMANDS = new Set(['dashboard', 'transactions', 'analytics']);

export function AppTopActions() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openGlobalCommandList = useNavigationStore((state) => state.openGlobalCommandList);
  const isNotificationsOpen = useNavigationStore((state) => state.isNotificationsOpen);
  const openNotifications = useNavigationStore((state) => state.openNotifications);
  const closeNotifications = useNavigationStore((state) => state.closeNotifications);

  if (currentScreen === 'ai-core') return null;

  const showCommandButton = SCREENS_WITH_COMMANDS.has(currentScreen);

  return (
    <>
      {showCommandButton ? (
        <div
          className="pointer-events-auto fixed left-4 top-[calc(env(safe-area-inset-top)+14px)] z-[85]"
          data-no-swipe="true"
        >
          <button
            type="button"
            onClick={openGlobalCommandList}
            className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#050b10]/74 px-3 text-sm text-white/78 shadow-2xl"
            aria-label="Команды"
          >
            <span className="text-emerald-200">⌘</span>
            <span>Команды</span>
          </button>
        </div>
      ) : null}

      <div
        className="pointer-events-auto fixed right-4 top-[calc(env(safe-area-inset-top)+14px)] z-[85]"
        data-no-swipe="true"
      >
        <div className="flex items-center gap-2">
          {currentScreen === 'settings' ? <LanguageSwitcher compact /> : null}

          <button
            type="button"
            onClick={openNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050b10]/74 text-base text-white/70 shadow-2xl"
            aria-label="Уведомления"
          >
            •
          </button>

          <button
            type="button"
            onClick={() => navigateTo('settings')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050b10]/74 text-lg text-emerald-100 shadow-2xl"
            aria-label="Настройки"
          >
            ⚙
          </button>
        </div>

        {isNotificationsOpen ? (
          <div className="absolute right-0 mt-3 w-[min(320px,calc(100vw-32px))] rounded-[26px] border border-white/10 bg-[#07111b]/96 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Уведомления</div>
                <div className="mt-1 text-xs leading-5 text-white/45">
                  Здесь появятся подтверждения, ошибки синхронизации и важные финансовые события.
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
                Если AI попросит подтверждение или найдёт важное изменение, оно появится здесь.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
