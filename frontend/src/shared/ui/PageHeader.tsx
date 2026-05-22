import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showHome?: boolean;
};

export function PageHeader({ title, subtitle, onBack, showHome = true }: Props) {
  return (
    <header className="px-4 pt-4" data-no-swipe="true">
      <ScreenTopBar title={title} left={onBack ? { label: 'Назад', onClick: onBack } : 'back'} right={showHome ? ['home'] : []} />
      {subtitle ? <div className="mx-auto mt-2 max-w-[560px] text-center text-xs text-white/38">{subtitle}</div> : null}
    </header>
  );
}
  