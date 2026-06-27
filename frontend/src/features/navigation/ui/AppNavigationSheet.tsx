import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { AppModalPortal } from '@/features/modals/ui/AppModalPortal';

type NavigationItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  captionKey: I18nKey;
  icon: 'goals' | 'limits' | 'obligations' | 'referral' | 'admin';
};

const baseLinks: NavigationItem[] = [
  { screen: 'goals', labelKey: 'screen.goals', captionKey: 'nav.goals.caption', icon: 'goals' },
  { screen: 'spending-limits', labelKey: 'screen.limits', captionKey: 'nav.limits.caption', icon: 'limits' },
  { screen: 'obligations', labelKey: 'screen.obligations', captionKey: 'nav.obligations.caption', icon: 'obligations' },
  { screen: 'referral', labelKey: 'common.referrals', captionKey: 'nav.referral.caption', icon: 'referral' },
];

const adminLink: NavigationItem = {
  screen: 'admin',
  labelKey: 'screen.admin',
  captionKey: 'nav.admin.caption',
  icon: 'admin',
};

function NavigationIcon({ icon }: { icon: NavigationItem['icon'] }) {
  if (icon === 'goals') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21a8.8 8.8 0 1 1 8.8-8.8A8.81 8.81 0 0 1 12 21Zm0-2a6.8 6.8 0 1 0-6.8-6.8A6.8 6.8 0 0 0 12 19Z" />
        <path d="M12 16a3.8 3.8 0 1 1 3.8-3.8A3.8 3.8 0 0 1 12 16Zm0-2a1.8 1.8 0 1 0-1.8-1.8A1.8 1.8 0 0 0 12 14Z" />
      </svg>
    );
  }

  if (icon === 'limits') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.2 18.8a8.8 8.8 0 1 1 13.6 0 1 1 0 0 1-1.55-1.26 6.8 6.8 0 1 0-10.5 0A1 1 0 0 1 5.2 18.8Z" />
        <path d="M13.2 12.55 16.3 8.9a1 1 0 0 0-1.52-1.3l-3.4 4a1.85 1.85 0 1 0 1.82.95Z" />
      </svg>
    );
  }

  if (icon === 'obligations') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.4 4.4h11.2A2.4 2.4 0 0 1 20 6.8v10.4a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 17.2V6.8a2.4 2.4 0 0 1 2.4-2.4Zm1.1 4.1a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2h-9Zm0 4.1a1 1 0 1 0 0 2h5.8a1 1 0 1 0 0-2H7.5Z" />
      </svg>
    );
  }

  if (icon === 'referral') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 12a4 4 0 1 1 3.56-2.18 1 1 0 0 1-1.78.9A2 2 0 1 0 8 12Zm8.6 0a3.4 3.4 0 1 1 2.9-1.62 1 1 0 1 1-1.7-1.05A1.4 1.4 0 1 0 16.6 12Z" />
        <path d="M3.6 19.2a4.4 4.4 0 0 1 8.8 0 1 1 0 0 1-2 0 2.4 2.4 0 0 0-4.8 0 1 1 0 0 1-2 0Zm9.8-.1a3.3 3.3 0 0 1 6.6 0 1 1 0 1 1-2 0 1.3 1.3 0 0 0-2.6 0 1 1 0 0 1-2 0Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4 19 6v5.2c0 4.46-2.74 7.8-7 9.4-4.26-1.6-7-4.94-7-9.4V6l7-2.6Zm0 4.1a2.2 2.2 0 0 0-1 4.16v3.24a1 1 0 0 0 2 0v-3.24a2.2 2.2 0 0 0-1-4.16Z" />
    </svg>
  );
}

export function AppNavigationSheet() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isOpen = useNavigationStore((state) => state.isNavigationMenuOpen);
  const close = useNavigationStore((state) => state.closeNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>(isOpen ? 'open' : 'closed');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const phaseRef = useRef(phase);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const swipeDistance = useRef(0);
  const isHorizontalGesture = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    drawerRef.current?.style.removeProperty('--app-navigation-swipe-x');
    swipeDistance.current = 0;
    isHorizontalGesture.current = false;
    setIsDragging(false);

    if (isOpen) {
      setPhase('opening');
      openTimer.current = window.setTimeout(() => {
        setPhase('open');
        openTimer.current = null;
      }, 360);
      return;
    }

    if (phaseRef.current === 'closed') return;

    setPhase('closing');
    closeTimer.current = window.setTimeout(() => {
      setPhase('closed');
      setIsExpanded(false);
      closeTimer.current = null;
    }, 320);

    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleNavigate = (screen: AppScreen) => {
    handleClose();
    window.setTimeout(() => navigateTo(screen), 180);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'open' && phaseRef.current !== 'opening') return;
    activePointerId.current = event.pointerId;
    startX.current = event.clientX;
    startY.current = event.clientY;
    swipeDistance.current = 0;
    isHorizontalGesture.current = false;
    drawerRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;

    const deltaX = event.clientX - startX.current;
    const deltaY = event.clientY - startY.current;

    if (!isHorizontalGesture.current) {
      if (Math.abs(deltaY) > 14 && Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (Math.abs(deltaX) < 8) return;
      isHorizontalGesture.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalGesture.current) return;
      setIsDragging(true);
    }

    if (deltaX >= 0) return;

    swipeDistance.current = Math.min(Math.abs(deltaX), isExpanded ? 220 : 130);
    drawerRef.current?.style.setProperty('--app-navigation-swipe-x', `${swipeDistance.current}px`);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;

    if (drawerRef.current?.hasPointerCapture(event.pointerId)) {
      drawerRef.current.releasePointerCapture(event.pointerId);
    }
    activePointerId.current = null;
    setIsDragging(false);

    if (swipeDistance.current > 48) {
      handleClose();
      return;
    }

    swipeDistance.current = 0;
    isHorizontalGesture.current = false;
    drawerRef.current?.style.removeProperty('--app-navigation-swipe-x');
  };

  if (phase === 'closed') return null;

  const links = isAdmin ? [...baseLinks, adminLink] : baseLinks;

  return (
    <AppModalPortal>
      <div
        className="app-navigation-layer"
        data-state={phase}
        data-no-swipe="true"
      >
        <div
          ref={drawerRef}
          className={`app-navigation-drawer${isExpanded ? ' is-expanded' : ''}${isDragging ? ' is-dragging' : ''}`}
          data-state={phase}
          data-no-swipe="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <button
            type="button"
            className="app-navigation-edge-close"
            onClick={handleClose}
            aria-label={t('common.close')}
          >
            <span aria-hidden="true">‹</span>
          </button>

          <header className="app-navigation-head">
            <span className="app-navigation-title">{t('nav.eyebrow')}</span>
            <button
              type="button"
              className="app-navigation-toggle"
              onClick={() => setIsExpanded((value) => !value)}
              aria-label={isExpanded ? t('common.close') : t('common.menu')}
              aria-expanded={isExpanded}
            >
              <span />
              <span />
            </button>
          </header>

          <div className="app-navigation-list" role="list">
            {links.map((item) => {
              const active = currentScreen === item.screen;
              return (
                <button
                  key={item.screen}
                  type="button"
                  className="app-navigation-item"
                  data-active={active}
                  onClick={() => handleNavigate(item.screen)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={t(item.labelKey)}
                  role="listitem"
                >
                  <span className="app-navigation-item__icon"><NavigationIcon icon={item.icon} /></span>
                  <span className="app-navigation-item__text">
                    <span>{t(item.labelKey)}</span>
                    <small>{t(item.captionKey)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}
