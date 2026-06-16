import type { ReactNode, TouchEvent } from 'react';
import { useFinaPullGesture } from '@/features/chat/lib/useFinaPullGesture';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { AppBottomNavigation } from '@/features/navigation/ui/AppBottomNavigation';
import { VoiceFirstCompanionLayer } from '@/features/voice/ui/VoiceFirstCompanionLayer';
import { useI18n } from '@/shared/lib/i18n';
import { OfflineStatusBadge } from '@/shared/ui/OfflineStatusBadge';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isNavigationMenuOpen = useNavigationStore((state) => state.isNavigationMenuOpen);
  const isNotificationsOpen = useNavigationStore((state) => state.isNotificationsOpen);
  const modalStackSize = useAppModalStore((state) => state.stack.length);
  const openModal = useAppModalStore((state) => state.openModal);
  const swipeHandlers = useSwipeNavigation();
  const finaPull = useFinaPullGesture({
    currentScreen,
    blocked: modalStackSize > 0 || isNavigationMenuOpen || isNotificationsOpen,
    openModal,
  });

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    finaPull.gestureHandlers.onTouchStart(event);
    swipeHandlers.onTouchStart(event);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    finaPull.gestureHandlers.onTouchMove(event);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    finaPull.gestureHandlers.onTouchEnd(event);
    swipeHandlers.onTouchEnd(event);
  };

  const handleTouchCancel = () => {
    finaPull.gestureHandlers.onTouchCancel();
  };

  return (
    <div className="telegram-app-shell ai-app-shell">
      <main
        ref={finaPull.rootRef}
        key={currentScreen}
        className="telegram-app-content ai-screen-transition app-shell-fina-pull-root"
        data-fina-pull-enabled={finaPull.isEnabled ? 'true' : 'false'}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {children}
      </main>

      <div
        className="app-fina-pull-indicator"
        aria-hidden="true"
        data-ready={finaPull.isReadyToOpen ? 'true' : 'false'}
        style={{
          opacity: finaPull.pullOffset ? Math.min(1, finaPull.pullOffset / 72) : 0,
          transform: `translate(-50%, ${Math.min(58, Math.max(0, finaPull.pullOffset - 20))}px)`,
        }}
      >
        <span className="app-fina-pull-indicator__dot" />
        <span>{finaPull.isReadyToOpen ? t('dashboard.finaPull.release') : t('dashboard.finaPull.pull')}</span>
      </div>

      <AppBottomNavigation />
      <VoiceFirstCompanionLayer />
      <OfflineStatusBadge />
    </div>
  );
}
