import type { ReactNode } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Action = 'back' | 'history' | 'settings' | 'home' | 'referral';
type LeftAction = 'menu' | 'back' | 'none' | { label: string; onClick: () => void };

type Props = {
  title: string;
  left?: LeftAction;
  right?: Action[];
  className?: string;
};

const actionIcon: Record<Action, ReactNode> = {
  back: '←',
  history: '◷',
  settings: '⚙',
  home: '⌂',
  referral: '↗',
};

const actionLabel: Record<Action, string> = {
  back: 'Назад',
  history: 'История',
  settings: 'Настройки',
  home: 'Домой',
  referral: 'Рефералы',
};

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="screen-top-bar__icon"
      data-no-swipe="true"
    >
      {children}
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

export function ScreenTopBar({ title, left = 'menu', right = ['history', 'settings'], className = '' }: Props) {
  const openNavigationMenu = useNavigationStore((state) => state.openNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);

  const handleAction = (action: Action) => {
    if (action === 'back') goBack();
    if (action === 'history') navigateTo('transactions');
    if (action === 'settings') navigateTo('settings');
    if (action === 'home') goHome();
    if (action === 'referral') navigateTo('referral');
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
            <IconButton key={action} label={actionLabel[action]} onClick={() => handleAction(action)}>
              {actionIcon[action]}
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  );
}
