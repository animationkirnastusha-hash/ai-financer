import type { ReactNode } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Action = 'commands' | 'back' | 'history' | 'settings' | 'home' | 'referral';
type LeftAction = 'commands' | 'back' | 'none' | { label: string; onClick: () => void };

type Props = {
  title: string;
  left?: LeftAction;
  right?: Action[];
  className?: string;
};

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#090f16]/72 text-[17px] text-white/72 shadow-xl shadow-black/20 transition active:scale-[0.97]"
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
      className="h-11 shrink-0 rounded-full border border-white/10 bg-[#090f16]/72 px-4 text-sm text-white/74 shadow-xl shadow-black/20 transition active:scale-[0.97]"
      data-no-swipe="true"
    >
      {children}
    </button>
  );
}

export function ScreenTopBar({ title, left = 'commands', right = ['history', 'settings'], className = '' }: Props) {
  const openGlobalCommandList = useNavigationStore((state) => state.openGlobalCommandList);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className={`screen-top-bar ${className}`} data-no-swipe="true">
      <div className="screen-top-bar__side screen-top-bar__side--left">
        {left === 'commands' ? (
          <TextButton label="Команды" onClick={openGlobalCommandList}>
            <span className="mr-2 text-emerald-200">⌘</span>
            Команды
          </TextButton>
        ) : null}
        {left === 'back' ? <TextButton label="Назад" onClick={goBack}>Назад</TextButton> : null}
        {typeof left === 'object' ? <TextButton label={left.label} onClick={left.onClick}>{left.label}</TextButton> : null}
      </div>

      <div className="screen-top-bar__title" title={title}>{title}</div>

      <div className="screen-top-bar__side screen-top-bar__side--right">
        {right.includes('referral') ? <IconButton label="Рефералы" onClick={() => navigateTo('referral')}>↗</IconButton> : null}
        {right.includes('history') ? <IconButton label="История" onClick={() => navigateTo('transactions')}>◷</IconButton> : null}
        {right.includes('settings') ? <IconButton label="Настройки" onClick={() => navigateTo('settings')}>⚙</IconButton> : null}
        {right.includes('home') ? <IconButton label="Домой" onClick={goHome}>⌂</IconButton> : null}
      </div>
    </div>
  );
}
