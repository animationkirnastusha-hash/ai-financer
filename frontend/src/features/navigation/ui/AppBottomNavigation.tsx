import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type BottomNavItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  icon: string;
};

const items: BottomNavItem[] = [
  { screen: 'dashboard', labelKey: 'screen.dashboard', icon: '⌂' },
  { screen: 'goals', labelKey: 'screen.goals', icon: '◎' },
  { screen: 'spending-limits', labelKey: 'screen.limits', icon: '◔' },
  { screen: 'journal', labelKey: 'screen.journal', icon: '≡' },
  { screen: 'profile', labelKey: 'screen.profile', icon: '◡' },
];

export function AppBottomNavigation() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <nav className="app-bottom-navigation" aria-label={t('bottomNav.label')} data-no-swipe="true">
      {items.map((item) => {
        const active = currentScreen === item.screen;
        return (
          <button
            key={item.screen}
            type="button"
            className="app-bottom-navigation__item"
            data-active={active}
            onClick={() => navigateTo(item.screen)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="app-bottom-navigation__icon" aria-hidden="true">{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
