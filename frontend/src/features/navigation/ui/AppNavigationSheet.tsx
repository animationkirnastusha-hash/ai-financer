import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type NavigationItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  captionKey: I18nKey;
};

type NavigationGroup = {
  titleKey: I18nKey;
  items: NavigationItem[];
};

const productLinks: NavigationItem[] = [
  { screen: 'dashboard', labelKey: 'screen.dashboard', captionKey: 'nav.dashboard.caption' },
  { screen: 'accounts', labelKey: 'screen.accounts', captionKey: 'nav.accounts.caption' },
  { screen: 'analytics', labelKey: 'common.analytics', captionKey: 'nav.analytics.caption' },
  { screen: 'sections', labelKey: 'screen.sections', captionKey: 'nav.sections.caption' },
];

const planningLinks: NavigationItem[] = [
  { screen: 'goals', labelKey: 'screen.goals', captionKey: 'nav.goals.caption' },
  { screen: 'obligations', labelKey: 'screen.obligations', captionKey: 'nav.obligations.caption' },
  { screen: 'spending-limits', labelKey: 'screen.limits', captionKey: 'nav.limits.caption' },
];

const growthLinks: NavigationItem[] = [
  { screen: 'store', labelKey: 'screen.store', captionKey: 'nav.store.caption' },
  { screen: 'referral', labelKey: 'common.referrals', captionKey: 'nav.referral.caption' },
];

const utilityLinks: NavigationItem[] = [
  { screen: 'settings', labelKey: 'common.settings', captionKey: 'nav.settings.caption' },
];

const adminLinks: NavigationItem[] = [
  { screen: 'business-accountant', labelKey: 'screen.business', captionKey: 'nav.business.caption' },
  { screen: 'admin', labelKey: 'screen.admin', captionKey: 'nav.admin.caption' },
];

export function AppNavigationSheet() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isOpen = useNavigationStore((state) => state.isNavigationMenuOpen);
  const close = useNavigationStore((state) => state.closeNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));

  if (!isOpen) return null;

  const groups: NavigationGroup[] = [
    { titleKey: 'nav.group.main', items: productLinks },
    { titleKey: 'nav.group.plan', items: planningLinks },
    { titleKey: 'nav.group.growth', items: growthLinks },
    { titleKey: 'nav.group.more', items: utilityLinks },
  ];

  if (isAdmin) groups.push({ titleKey: 'nav.group.admin', items: adminLinks });

  const handleNavigate = (screen: AppScreen) => {
    close();
    navigateTo(screen);
  };

  return (
    <div className="app-modal-backdrop app-navigation-backdrop" data-no-swipe="true" onClick={close}>
      <div className="app-modal-sheet app-navigation-sheet app-navigation-sheet--structured" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-navigation-head">
            <div>
              <div className="app-eyebrow">{t('nav.eyebrow')}</div>
              <h2>{t('nav.title')}</h2>
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
  );
}
