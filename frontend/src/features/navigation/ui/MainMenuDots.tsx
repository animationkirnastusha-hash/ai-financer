import { useEffect, useState } from 'react';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type DotItem = {
  screen: AppScreen;
  aria: string;
};

type Props = {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  items?: DotItem[];
  bottomOffset?: number;
};

const MAIN_ITEMS: DotItem[] = [
  { screen: 'dashboard', aria: 'Dashboard' },
  { screen: 'ai-core', aria: 'AI Core' },
  { screen: 'accounts', aria: 'Accounts' },
];

export const SETTINGS_FLOW_ITEMS: DotItem[] = [
  { screen: 'settings', aria: 'Настройки' },
  { screen: 'taxonomy-settings', aria: 'Разделы и категории' },
];

export function MainMenuDots({
  currentScreen,
  onNavigate,
  items = MAIN_ITEMS,
  bottomOffset = 8,
}: Props) {
  const [composerFocused, setComposerFocused] = useState(false);

  useEffect(() => {
    const sync = () => {
      setComposerFocused(document.body.classList.contains('ai-composer-focused'));
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`main-nav-dots pointer-events-auto fixed left-0 right-0 z-[70] flex justify-center px-4 transition duration-200 ${
        composerFocused ? 'translate-y-2 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottomOffset}px)` }}
      data-no-swipe="true"
      aria-hidden={composerFocused}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 shadow-2xl backdrop-blur-xl">
        {items.map((item) => {
          const active = item.screen === currentScreen;

          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className={`h-3 w-3 rounded-full transition ${
                active
                  ? 'scale-110 bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.45)]'
                  : 'bg-white/25 hover:bg-white/40'
              }`}
              aria-label={item.aria}
              title={item.aria}
              tabIndex={composerFocused ? -1 : 0}
            />
          );
        })}
      </div>
    </div>
  );
}
