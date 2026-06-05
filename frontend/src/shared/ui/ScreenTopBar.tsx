import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useNotificationsStore } from '@/features/notifications/model/notifications.store';

type Action = 'back' | 'analytics' | 'history' | 'settings' | 'home' | 'referral' | 'notifications';
type LeftAction = 'menu' | 'back' | 'none' | { label: string; onClick: () => void };

type Props = {
  title: string;
  left?: LeftAction;
  right?: Action[];
  className?: string;
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M12 21a2.2 2.2 0 0 0 2.05-1.42h-4.1A2.2 2.2 0 0 0 12 21Z" />
      <path d="M18.7 16.25 17.5 14.7V10a5.5 5.5 0 0 0-4.25-5.36V3.8a1.25 1.25 0 0 0-2.5 0v.84A5.5 5.5 0 0 0 6.5 10v4.7l-1.2 1.55a1.05 1.05 0 0 0 .84 1.7h11.72a1.05 1.05 0 0 0 .84-1.7Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M5 19.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 2 0v12h13a1 1 0 1 1 0 2H5Z" />
      <path d="M9 15.5a1 1 0 0 1-1-1v-3a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1v-7a1 1 0 1 1 2 0v7a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1v-5a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z" />
      <path d="M19.3 13.35c.06-.44.06-.91 0-1.35l1.45-1.12a.78.78 0 0 0 .18-.98l-1.38-2.38a.78.78 0 0 0-.93-.34l-1.7.68a7.4 7.4 0 0 0-1.15-.67l-.26-1.82a.78.78 0 0 0-.77-.67h-2.75a.78.78 0 0 0-.77.67l-.26 1.82c-.4.18-.78.4-1.15.67l-1.7-.68a.78.78 0 0 0-.93.34L3.69 9.9a.78.78 0 0 0 .18.98L5.32 12c-.06.44-.06.91 0 1.35l-1.45 1.12a.78.78 0 0 0-.18.98l1.38 2.38c.2.34.6.48.93.34l1.7-.68c.36.27.75.49 1.15.67l.26 1.82c.06.38.39.67.77.67h2.75c.38 0 .71-.29.77-.67l.26-1.82c.4-.18.78-.4 1.15-.67l1.7.68c.34.14.74 0 .93-.34l1.38-2.38a.78.78 0 0 0-.18-.98l-1.45-1.12Zm-7.3 3.2a4.55 4.55 0 1 1 0-9.1 4.55 4.55 0 0 1 0 9.1Z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M4.5 11.2 12 5l7.5 6.2v7.2a1.6 1.6 0 0 1-1.6 1.6h-3.2v-5.2H9.3V20H6.1a1.6 1.6 0 0 1-1.6-1.6v-7.2Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M15.7 5.3a1 1 0 0 1 0 1.4L11.4 11H19a1 1 0 1 1 0 2h-7.6l4.3 4.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

function ReferralIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="screen-top-bar__svg">
      <path d="M14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V7.4l-6.3 6.3a1 1 0 0 1-1.4-1.4L16.6 6H15a1 1 0 0 1-1-1Z" />
      <path d="M5 7a2 2 0 0 1 2-2h4a1 1 0 1 1 0 2H7v10h10v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

const actionIcon: Record<Action, ReactNode> = {
  back: <ArrowIcon />,
  analytics: <ChartIcon />,
  history: <ChartIcon />,
  settings: <GearIcon />,
  home: <HomeIcon />,
  referral: <ReferralIcon />,
  notifications: <BellIcon />,
};

const actionLabel: Record<Action, string> = {
  back: 'Назад',
  analytics: 'Аналитика',
  history: 'Аналитика',
  settings: 'Настройки',
  home: 'Домой',
  referral: 'Рефералы',
  notifications: 'Уведомления',
};

function IconButton({ children, label, onClick, badge }: { children: ReactNode; label: string; onClick: () => void; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="screen-top-bar__icon"
      data-no-swipe="true"
      data-has-badge={Boolean(badge && badge > 0)}
    >
      {children}
      {badge && badge > 0 ? <span className="screen-top-bar__badge">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

function TextButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="screen-top-bar__text-button"
      data-no-swipe="true"
    >
      {children}
    </button>
  );
}

export function ScreenTopBar({ title, left = 'menu', right = ['notifications', 'analytics', 'settings'], className = '' }: Props) {
  const openNavigationMenu = useNavigationStore((state) => state.openNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);
  const openModal = useAppModalStore((state) => state.openModal);
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const loadUnreadCount = useNotificationsStore((state) => state.loadUnreadCount);

  useEffect(() => {
    if (right.includes('notifications')) void loadUnreadCount();
  }, [loadUnreadCount, right]);

  const handleAction = (action: Action) => {
    if (action === 'back') goBack();
    if (action === 'analytics' || action === 'history') navigateTo('analytics');
    if (action === 'settings') navigateTo('settings');
    if (action === 'home') goHome();
    if (action === 'referral') navigateTo('referral');
    if (action === 'notifications') openModal({ type: 'notifications' });
  };

  return (
    <div className={`screen-top-bar ${className}`} data-no-swipe="true">
      <div className="screen-top-bar__title" title={title}>{title}</div>

      <div className="screen-top-bar__actions">
        <div className="screen-top-bar__side screen-top-bar__side--left">
          {left === 'menu' ? <TextButton label="Меню" onClick={openNavigationMenu}>Меню</TextButton> : null}
          {left === 'back' ? <TextButton label="Назад" onClick={goBack}>Назад</TextButton> : null}
          {typeof left === 'object' ? <TextButton label={left.label} onClick={left.onClick}>{left.label}</TextButton> : null}
        </div>

        <div className="screen-top-bar__side screen-top-bar__side--right">
          {right.map((action) => (
            <IconButton key={action} label={actionLabel[action]} onClick={() => handleAction(action)} badge={action === 'notifications' ? unreadCount : undefined}>
              {actionIcon[action]}
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  );
}
