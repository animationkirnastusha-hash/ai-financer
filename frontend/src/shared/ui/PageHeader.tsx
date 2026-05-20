import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showHome?: boolean;
};

const MAIN_SCREENS = new Set(['dashboard', 'transactions', 'analytics']);

export function PageHeader({ title, subtitle, onBack, showHome = true }: Props) {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);
  const isMainScreen = MAIN_SCREENS.has(currentScreen);
  const canGoBack = Boolean(onBack) || !isMainScreen;
  const shouldShowHome = showHome && !isMainScreen;
  const handleBack = onBack ?? goBack;

  return (
    <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+18px)]" data-no-swipe="true">
      <div className="mx-auto grid max-w-[560px] grid-cols-[80px_1fr_80px] items-center gap-3">
        {canGoBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/72"
          >
            Назад
          </button>
        ) : (
          <div aria-hidden="true" />
        )}

        <div className="min-w-0 text-center">
          <div className="truncate text-[10px] uppercase tracking-[0.18em] text-white/35">
            {title}
          </div>
          {subtitle ? <div className="mt-1 truncate text-xs text-white/45">{subtitle}</div> : null}
        </div>

        {shouldShowHome ? (
          <button
            type="button"
            onClick={goHome}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/72"
          >
            Домой
          </button>
        ) : (
          <div aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
