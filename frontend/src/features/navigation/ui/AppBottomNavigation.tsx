import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type BottomNavItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  icon: 'home' | 'accounts' | 'analytics' | 'journal';
};

const mainItems: BottomNavItem[] = [
  { screen: 'dashboard', labelKey: 'screen.dashboard', icon: 'home' },
  { screen: 'accounts', labelKey: 'screen.accounts', icon: 'accounts' },
  { screen: 'analytics', labelKey: 'common.analytics', icon: 'analytics' },
  { screen: 'journal', labelKey: 'screen.journal', icon: 'journal' },
];

function NavIcon({ icon }: { icon: BottomNavItem['icon'] }) {
  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.4 11.25 12 5l7.6 6.25v7.1A1.65 1.65 0 0 1 17.95 20h-3.2v-5.25h-5.5V20h-3.2a1.65 1.65 0 0 1-1.65-1.65v-7.1Z" />
      </svg>
    );
  }

  if (icon === 'accounts') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.4 6.2h13.2A2.4 2.4 0 0 1 21 8.6v6.8a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 15.4V8.6a2.4 2.4 0 0 1 2.4-2.4Zm.2 3.1v1.65h12.8V9.3H5.6Zm0 4.55v1.1h5.8v-1.1H5.6Z" />
      </svg>
    );
  }

  if (icon === 'analytics') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.3 19.4a1 1 0 0 1-1-1V5.6a1 1 0 0 1 2 0v11.8h12.4a1 1 0 1 1 0 2H5.3Z" />
        <path d="M9 15.5a1 1 0 0 1-1-1v-3.2a1 1 0 1 1 2 0v3.2a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1V8.1a1 1 0 1 1 2 0v6.4a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1v-4.8a1 1 0 1 1 2 0v4.8a1 1 0 0 1-1 1Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6.7a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm0 5.3a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm0 5.3a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function getProfileInitial(firstName?: string | null, username?: string | null) {
  const value = firstName?.trim() || username?.trim() || 'F';
  return value.slice(0, 1).toUpperCase();
}

export function AppBottomNavigation() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);
  const profileActive = currentScreen === 'profile';

  return (
    <nav className="app-bottom-navigation" aria-label={t('bottomNav.label')} data-no-swipe="true">
      <div className="app-bottom-navigation__cluster app-bottom-navigation__cluster--main">
        {mainItems.map((item) => {
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
              <span className="app-bottom-navigation__icon" aria-hidden="true"><NavIcon icon={item.icon} /></span>
              <span className="app-bottom-navigation__label">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="app-bottom-navigation__cluster app-bottom-navigation__cluster--profile">
        <button
          type="button"
          className="app-bottom-navigation__item app-bottom-navigation__profile-button"
          data-active={profileActive}
          data-profile="true"
          onClick={() => navigateTo('profile')}
          aria-label={t('screen.profile')}
          aria-current={profileActive ? 'page' : undefined}
        >
          <span className="app-bottom-navigation__avatar" aria-hidden="true">
            {user?.photoUrl ? <img src={user.photoUrl} alt="" /> : <span>{getProfileInitial(user?.firstName, user?.username)}</span>}
          </span>
        </button>
      </div>
    </nav>
  );
}
