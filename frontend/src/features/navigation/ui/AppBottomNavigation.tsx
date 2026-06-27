import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type BottomNavItem = {
  screen: AppScreen;
  labelKey: I18nKey;
  icon: 'home' | 'accounts' | 'analytics' | 'journal' | 'profile';
};

const mainItems: BottomNavItem[] = [
  { screen: 'dashboard', labelKey: 'screen.dashboard', icon: 'home' },
  { screen: 'accounts', labelKey: 'screen.accounts', icon: 'accounts' },
  { screen: 'analytics', labelKey: 'screen.analytics', icon: 'analytics' },
  { screen: 'journal', labelKey: 'screen.journal', icon: 'journal' },
];

const profileItem: BottomNavItem = { screen: 'profile', labelKey: 'screen.profile', icon: 'profile' };

function BottomNavIcon({ icon }: { icon: BottomNavItem['icon'] }) {
  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.4 11.1 12 4.9l7.6 6.2v7.5a1.7 1.7 0 0 1-1.7 1.7h-3.5v-5.4H9.6v5.4H6.1a1.7 1.7 0 0 1-1.7-1.7v-7.5Z" />
      </svg>
    );
  }

  if (icon === 'accounts') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.6 6.2h12.8A2.6 2.6 0 0 1 21 8.8v8.4a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 17.2V8.8a2.6 2.6 0 0 1 2.6-2.6Zm-.4 4.1h13.6V8.9a.7.7 0 0 0-.7-.7H5.9a.7.7 0 0 0-.7.7v1.4Zm2.3 5.3a1 1 0 0 0 0 2h4.2a1 1 0 1 0 0-2H7.5Z" />
      </svg>
    );
  }

  if (icon === 'analytics') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19.2a1 1 0 0 1-1-1V5.8a1 1 0 1 1 2 0v11.4h12.2a1 1 0 1 1 0 2H5Z" />
        <path d="M9 15.5a1 1 0 0 1-1-1v-2.2a1 1 0 1 1 2 0v2.2a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1V8.4a1 1 0 1 1 2 0v6.1a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1v-4.1a1 1 0 1 1 2 0v4.1a1 1 0 0 1-1 1Z" />
      </svg>
    );
  }

  if (icon === 'journal') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Zm1.2 4a1 1 0 0 0 0 2h7.6a1 1 0 1 0 0-2H8.2Zm0 3.5a1 1 0 1 0 0 2h7.6a1 1 0 1 0 0-2H8.2Zm0 3.5a1 1 0 1 0 0 2h4.8a1 1 0 1 0 0-2H8.2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.1a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2.1c-4.2 0-7.5 2.2-7.5 4.9 0 .7.6 1.2 1.3 1.2h12.4c.7 0 1.3-.5 1.3-1.2 0-2.7-3.3-4.9-7.5-4.9Z" />
    </svg>
  );
}

function getInitials(firstName?: string | null, username?: string | null) {
  const source = (firstName || username || 'F').trim();
  return source.slice(0, 1).toUpperCase();
}

function ProfileAvatar() {
  const user = useAuthStore((state) => state.user);

  if (user?.photoUrl) {
    return <img src={user.photoUrl} alt="" className="app-bottom-navigation__avatar-image" loading="lazy" />;
  }

  return <span className="app-bottom-navigation__avatar-fallback">{getInitials(user?.firstName, user?.username)}</span>;
}

function NavButton({ item, profile = false }: { item: BottomNavItem; profile?: boolean }) {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const active = currentScreen === item.screen;

  return (
    <button
      type="button"
      className="app-bottom-navigation__item"
      data-active={active}
      data-profile={profile ? 'true' : undefined}
      onClick={() => navigateTo(item.screen)}
      aria-current={active ? 'page' : undefined}
      aria-label={t(item.labelKey)}
    >
      {profile ? (
        <span className="app-bottom-navigation__avatar" aria-hidden="true"><ProfileAvatar /></span>
      ) : (
        <>
          <span className="app-bottom-navigation__icon" aria-hidden="true"><BottomNavIcon icon={item.icon} /></span>
          <span className="app-bottom-navigation__label">{t(item.labelKey)}</span>
        </>
      )}
    </button>
  );
}

export function AppBottomNavigation() {
  const { t } = useI18n();

  return (
    <nav className="app-bottom-navigation" aria-label={t('bottomNav.label')} data-no-swipe="true">
      <div className="app-bottom-navigation__cluster app-bottom-navigation__cluster--main">
        {mainItems.map((item) => <NavButton key={item.screen} item={item} />)}
      </div>
      <div className="app-bottom-navigation__cluster app-bottom-navigation__cluster--profile">
        <NavButton item={profileItem} profile />
      </div>
    </nav>
  );
}
