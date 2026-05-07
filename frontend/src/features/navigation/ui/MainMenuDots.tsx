import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Props = {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
};

const items: Array<{ screen: AppScreen; label: string; aria: string }> = [
  { screen: 'dashboard', label: '•', aria: 'dashboard' },
  { screen: 'ai-core', label: '•', aria: 'ai-core' },
  { screen: 'sections', label: '•', aria: 'sections' },
  { screen: 'settings', label: '•', aria: 'settings' },
];

export function MainMenuDots({ currentScreen, onNavigate }: Props) {
  return (
    <div
      className="main-nav-dots pointer-events-auto fixed left-0 right-0 z-[70] flex justify-center px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      data-no-swipe="true"
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
        {items.map((item) => {
          const active = item.screen === currentScreen;

          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className={`h-3 w-3 rounded-full transition ${
                active ? 'bg-emerald-300' : 'bg-white/25'
              }`}
              aria-label={item.aria}
              title={item.aria}
            />
          );
        })}
      </div>
    </div>
  );
}
