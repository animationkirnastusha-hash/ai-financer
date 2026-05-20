import type { ReactNode } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { AppTopActions } from '@/features/navigation/ui/AppTopActions';
import { MainMenuDots, MAIN_ITEMS } from '@/features/navigation/ui/MainMenuDots';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export function AppShell({ children }: { children: ReactNode }) {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const goBack = useNavigationStore((state) => state.goBack);

  useSwipeNavigation({ currentScreen, navigateTo, goBack });

  const showMainDots = MAIN_ITEMS.some((item) => item.screen === currentScreen);
  const showCompanion = currentScreen !== 'ai-core';

  return (
    <div className="telegram-app-shell ai-app-shell">
      <main key={currentScreen} className="telegram-app-content ai-screen-transition">
        {children}
      </main>

      <AppTopActions />

      {showCompanion ? (
        <div
          className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-[80]"
          data-no-swipe="true"
        >
          <CompanionButton
            mood="calm"
            size="md"
            label="Открыть AI"
            onClick={() => openAIWithCommand()}
          />
        </div>
      ) : null}

      {showMainDots ? (
        <MainMenuDots currentScreen={currentScreen} onNavigate={navigateTo} items={MAIN_ITEMS} />
      ) : null}
    </div>
  );
}
