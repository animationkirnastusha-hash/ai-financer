import type { CSSProperties, TouchEvent } from 'react';
import { useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { AppModalPortal } from '@/features/modals/ui/AppModalPortal';

type NavigationItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  captionKey: I18nKey;
};

type NavigationGroup = {
  titleKey: I18nKey;
  items: NavigationItem[];
};

const sectionLinks: NavigationItem[] = [
  { screen: 'goals', labelKey: 'screen.goals', captionKey: 'nav.goals.caption' },
  { screen: 'spending-limits', labelKey: 'screen.limits', captionKey: 'nav.limits.caption' },
  { screen: 'obligations', labelKey: 'screen.obligations', captionKey: 'nav.obligations.caption' },
  { screen: 'referral', labelKey: 'common.referrals', captionKey: 'nav.referral.caption' },
];

const adminLinks: NavigationItem[] = [
  { screen: 'admin', labelKey: 'screen.admin', captionKey: 'nav.admin.caption' },
];

export function AppNavigationSheet() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isOpen = useNavigationStore((state) => state.isNavigationMenuOpen);
  const close = useNavigationStore((state) => state.closeNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  if (!isOpen) return null;

  const groups: NavigationGroup[] = [
    { titleKey: 'nav.group.plan', items: sectionLinks },
  ];

  if (isAdmin) groups.push({ titleKey: 'nav.group.admin', items: adminLinks });

  const resetDragOffset = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleNavigate = (screen: AppScreen) => {
    resetDragOffset();
    close();
    navigateTo(screen);
  };

  const handleClose = () => {
    resetDragOffset();
    close();
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    resetDragOffset();
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = event.touches[0];
    const deltaX = touchStartX.current - touch.clientX;
    const deltaY = Math.abs(touchStartY.current - touch.clientY);

    if (deltaX > 0 && deltaX > deltaY) {
      const nextOffset = Math.min(120, deltaX);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetRef.current > 58) {
      handleClose();
      return;
    }

    touchStartX.current = null;
    touchStartY.current = null;
    resetDragOffset();
  };

  return (
    <AppModalPortal>
      <div className="app-navigation-backdrop" data-no-swipe="true" onClick={handleClose}>
        <aside
          className="app-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.title')}
          data-no-swipe="true"
          style={{ '--app-navigation-swipe-x': `${dragOffset}px` } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <button type="button" className="app-navigation-drawer__rail" onClick={handleClose} aria-label={t('common.close')}>‹</button>

          <div className="app-navigation-head">
            <div>
              <div className="app-eyebrow">{t('nav.eyebrow')}</div>
              <h2>{t('nav.title')}</h2>
              <p>{t('nav.caption')}</p>
            </div>
            <button type="button" className="app-navigation-close" onClick={handleClose} aria-label={t('common.close')}>×</button>
          </div>

          <div className="app-navigation-groups">
            {groups.map((group) => (
              <section key={group.titleKey} className="app-navigation-group">
                <div className="app-navigation-group__title">{t(group.titleKey)}</div>
                <div className="app-navigation-grid">
                  {group.items.map((item) => (
                    <button
                      key={item.screen}
                      type="button"
                      className="app-navigation-item"
                      data-active={currentScreen === item.screen}
                      onClick={() => handleNavigate(item.screen)}
                    >
                      <span>{t(item.labelKey)}</span>
                      <small>{t(item.captionKey)}</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="app-navigation-swipe-hint">{t('nav.drawer.swipeHint')}</div>
        </aside>
      </div>
    </AppModalPortal>
  );
}
