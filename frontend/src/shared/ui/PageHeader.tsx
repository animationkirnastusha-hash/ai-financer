import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showHome?: boolean;
};

export function PageHeader({ title, subtitle, onBack, showHome = true }: Props) {
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);
  const handleBack = onBack ?? goBack;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4" data-no-swipe="true">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/72"
      >
        Назад
      </button>

      <div className="min-w-0 text-center">
        <div className="truncate text-[10px] uppercase tracking-[0.18em] text-white/35">
          {title}
        </div>
        {subtitle ? <div className="mt-1 truncate text-xs text-white/45">{subtitle}</div> : null}
      </div>

      {showHome ? (
        <button
          type="button"
          onClick={goHome}
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/72"
        >
          Домой
        </button>
      ) : (
        <div className="h-10 w-[66px]" aria-hidden="true" />
      )}
    </div>
  );
}
