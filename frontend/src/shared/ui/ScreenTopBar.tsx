import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useNotificationsStore } from '@/features/notifications/model/notifications.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { SettingsGearIcon } from '@/shared/ui/AppIcons';

type Action = 'back' | 'analytics' | 'history' | 'settings' | 'home' | 'referral' | 'notifications';
type LeftAction = 'menu' | 'back' | 'none' | { label: string; onClick: () => void };

type Props = {
  title: string;
  left?: LeftAction;
  right?: Action[];
  className?: string;
};

const DEFAULT_RIGHT_ACTIONS: Action[] = ['notifications', 'analytics', 'settings'];

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
  return <SettingsGearIcon className="screen-top-bar__svg" />;
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

const actionLabelKey: Record<Action, I18nKey> = {
  back: 'common.back',
  analytics: 'common.analytics',
  history: 'screen.journal',
  settings: 'common.settings',
  home: 'common.home',
  referral: 'common.referrals',
  notifications: 'common.notifications',
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

function TextButton({ children, label, onClick, compact = false }: { children: ReactNode; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={compact ? 'screen-top-bar__text-button screen-top-bar__text-button--chevron' : 'screen-top-bar__text-button'}
      data-no-swipe="true"
    >
      {children}
    </button>
  );
}

function BackChevron() {
  return <span className="screen-top-bar__chevron" aria-hidden="true">‹</span>;
}

function isBackLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  return normalized === 'назад' || normalized === 'back' || normalized === '<' || normalized === '‹';
}

export function ScreenTopBar({ title, left = 'menu', right = DEFAULT_RIGHT_ACTIONS, className = '' }: Props) {
  const { t } = useI18n();
  const openNavigationMenu = useNavigationStore((state) => state.openNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);
  const openJournal = useNavigationStore((state) => state.openJournal);
  const openModal = useAppModalStore((state) => state.openModal);
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const loadUnreadCount = useNotificationsStore((state) => state.loadUnreadCount);
  const visibleRight = right.filter((action) => action !== 'home');

  useEffect(() => {
    if (visibleRight.includes('notifications')) void loadUnreadCount();
  }, [loadUnreadCount, visibleRight]);

  const handleAction = (action: Action) => {
    if (action === 'back') goBack();
    if (action === 'analytics') navigateTo('analytics');
    if (action === 'history') openJournal({ period: 'month' });
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
          {left === 'menu' ? <TextButton label={t('common.menu')} onClick={openNavigationMenu}>{t('common.menu')}</TextButton> : null}
          {left === 'back' ? <TextButton label={t('common.back')} onClick={goBack} compact><BackChevron /></TextButton> : null}
          {typeof left === 'object' ? (
            <TextButton label={left.label} onClick={left.onClick} compact={isBackLabel(left.label)}>
              {isBackLabel(left.label) ? <BackChevron /> : left.label}
            </TextButton>
          ) : null}
        </div>

        <div className="screen-top-bar__side screen-top-bar__side--right">
          {visibleRight.map((action) => (
            <IconButton key={action} label={t(actionLabelKey[action])} onClick={() => handleAction(action)} badge={action === 'notifications' ? unreadCount : undefined}>
              {actionIcon[action]}
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  );
}
