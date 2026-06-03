import type { ReactNode } from 'react';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { VoiceFirstCompanionLayer } from '@/features/voice/ui/VoiceFirstCompanionLayer';

export function AppShell({ children }: { children: ReactNode }) {
  const currentScreen = useNavigationStore((state) => state.currentScreen);

  const swipeHandlers = useSwipeNavigation();


  return (
    <div className="telegram-app-shell ai-app-shell">
      <main key={currentScreen} className="telegram-app-content ai-screen-transition" {...swipeHandlers}>
        {children}
      </main>

      <VoiceFirstCompanionLayer />

     
    </div>
  );
}
