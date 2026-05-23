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

export const MAIN_ITEMS: DotItem[] = [
  { screen: 'transactions', aria: 'Операции' },
  { screen: 'dashboard', aria: 'Главная' },
  { screen: 'analytics', aria: 'Аналитика' },
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
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHidden(
        document.body.classList.contains('ai-composer-focused') ||
          document.body.classList.contains('ai-modal-open') ||
          document.body.classList.contains('ai-any-modal-open') ||
          document.body.classList.contains('ai-core-modal-open'),
      );
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
      className={`app-main-menu-dots pointer-events-auto fixed left-0 right-0 flex justify-center px-4 transition duration-200 ${
        hidden ? 'translate-y-2 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottomOffset}px)` }}
      data-no-swipe="true"
      aria-hidden={hidden}
    >
      <div className="app-main-menu-dots__panel flex items-center gap-2 rounded-full border border-white/10 bg-[#050b10]/78 px-3 py-2 shadow-2xl">
        {items.map((item) => {
          const active = item.screen === currentScreen;

          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className={`h-2.5 rounded-full transition ${
                active
                  ? 'w-7 bg-emerald-200 shadow-[0_0_16px_rgba(110,231,183,0.45)]'
                  : 'w-2.5 bg-white/24 hover:bg-white/42'
              }`}
              aria-label={item.aria}
              title={item.aria}
              tabIndex={hidden ? -1 : 0}
            />
          );
        })}
      </div>
    </div>
  );
}
