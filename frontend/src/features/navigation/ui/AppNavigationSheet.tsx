import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { canShowStoreSurface, hasFeatureAccess } from '@/features/subscription/lib/entitlements';
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

const moneyLinks: NavigationItem[] = [
  { screen: 'accounts', labelKey: 'screen.accounts', captionKey: 'nav.accounts.caption' },
  { screen: 'analytics', labelKey: 'common.analytics', captionKey: 'nav.analytics.caption' },
  { screen: 'obligations', labelKey: 'screen.obligations', captionKey: 'nav.obligations.caption' },
];

const setupLinks: NavigationItem[] = [
  { screen: 'sections', labelKey: 'screen.sections', captionKey: 'nav.sections.caption' },
];

const storeLinks: NavigationItem[] = [
  { screen: 'store', labelKey: 'screen.store', captionKey: 'nav.store.caption' },
];

const receiptLinks: NavigationItem[] = [
  { screen: 'receipt-scans', labelKey: 'screen.receipts', captionKey: 'nav.receipts.caption' },
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
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const canShowStore = canShowStoreSurface(subscription);
  const canShowReceipts = hasFeatureAccess(subscription, 'receiptScan');

  useEffect(() => {
    if (isOpen && user && !subscription) void loadSubscription();
  }, [isOpen, loadSubscription, subscription, user]);

  if (!isOpen) return null;

  const groups: NavigationGroup[] = [
    { titleKey: 'nav.group.money', items: moneyLinks },
    { titleKey: 'nav.group.setup', items: setupLinks },
  ];

  if (canShowStore) groups.push({ titleKey: 'nav.group.store', items: storeLinks });
  if (canShowReceipts) groups.push({ titleKey: 'nav.group.premium', items: receiptLinks });
  if (isAdmin) groups.push({ titleKey: 'nav.group.admin', items: adminLinks });

  const handleNavigate = (screen: AppScreen) => {
    close();
    navigateTo(screen);
  };

  return (
    <AppModalPortal>
      <div className="app-modal-backdrop app-navigation-backdrop" data-no-swipe="true" onClick={close}>
        <div className="app-modal-sheet app-navigation-sheet app-navigation-sheet--structured app-navigation-sheet--ia" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
          <div className="app-modal-handle" />
          <div className="app-modal-body">
          <div className="app-navigation-head">
            <div>
              <div className="app-eyebrow">{t('nav.eyebrow')}</div>
              <h2>{t('nav.title')}</h2>
              <p>{t('nav.caption')}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={close} aria-label={t('common.close')}>×</button>
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
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}
