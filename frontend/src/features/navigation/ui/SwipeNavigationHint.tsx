import type { AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
};

const items: Array<{ screen: AppScreen; labelKey: 'screen.dashboard' | 'screen.accounts' | 'common.settings' }> = [
  { screen: 'dashboard', labelKey: 'screen.dashboard' },
  { screen: 'accounts', labelKey: 'screen.accounts' },
  { screen: 'settings', labelKey: 'common.settings' },
];

export function SwipeNavigationHint({ currentScreen, onNavigate }: Props) {
  const { t } = useI18n();

  return (
    <div className="pointer-events-auto fixed left-0 right-0 z-[70] px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
      data-no-swipe="true"
    >
      <div className="mx-auto flex max-w-[360px] items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 p-1.5 backdrop-blur-xl">
        {items.map((item) => {
          const active = item.screen === currentScreen;

          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className={`rounded-full px-3 py-2 text-[11px] transition ${
                active
                  ? 'bg-emerald-400/15 text-emerald-100'
                  : 'text-white/45'
              }`}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-center text-[10px] text-white/30">
        {t('nav.swipeHint')}
      </div>
    </div>
  );
}
