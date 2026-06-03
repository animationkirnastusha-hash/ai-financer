import type { ReactNode } from 'react';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { MainMenuDots, MAIN_ITEMS } from '@/features/navigation/ui/MainMenuDots';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { VoiceFirstCompanionLayer } from '@/features/voice/ui/VoiceFirstCompanionLayer';

export function AppShell({ children }: { children: ReactNode }) {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  useSwipeNavigation();

  const showMainDots = MAIN_ITEMS.some((item) => item.screen === currentScreen);

  return (
    <div className="telegram-app-shell ai-app-shell">
      <main key={currentScreen} className="telegram-app-content ai-screen-transition">
        {children}
      </main>

      <VoiceFirstCompanionLayer />

      {showMainDots ? <MainMenuDots currentScreen={currentScreen} onNavigate={navigateTo} items={MAIN_ITEMS} /> : null}
    </div>
  );
}
