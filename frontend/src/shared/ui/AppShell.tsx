import type { ReactNode } from 'react';
import type { AppScreen } from '@/features/navigation/model/navigation.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';

type NavItem = {
  screen: AppScreen;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { screen: 'dashboard', label: 'Обзор', icon: '⌁' },
  { screen: 'transactions', label: 'Операции', icon: '≡' },
  { screen: 'accounts', label: 'Счета', icon: '◈' },
  { screen: 'analytics', label: 'Аналитика', icon: '⌬' },
  { screen: 'goals', label: 'Цели', icon: '◇' },
  { screen: 'companion', label: 'Companion', icon: '●' },
  { screen: 'settings', label: 'Settings', icon: '⚙' },
  { screen: 'premium', label: 'Premium', icon: '✦' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <div className="telegram-app-shell ai-app-shell">
      <main key={currentScreen} className="telegram-app-content ai-screen-transition">
        {children}
      </main>

      {currentScreen !== 'companion' ? (
        <div className="ai-assistant-dock pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+86px)] right-4 z-[80]">
          <CompanionPresence compact />
        </div>
      ) : null}

      <nav className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 z-[75] rounded-[26px] border border-white/10 bg-[#050b10]/86 p-2 shadow-2xl">
        <div className="grid grid-cols-8 gap-1">
          {navItems.map((item) => {
            const active = item.screen === currentScreen;
            return (
              <button
                key={item.screen}
                type="button"
                onClick={() => navigateTo(item.screen)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-[20px] px-1.5 py-2 text-[10px] transition ${
                  active ? 'bg-emerald-300/14 text-emerald-100' : 'text-white/42 hover:bg-white/[0.05] hover:text-white/70'
                }`}
              >
                <span className="text-[15px] leading-none">{item.icon}</span>
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
