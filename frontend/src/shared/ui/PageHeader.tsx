import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  title: string;
  onBack?: () => void;
};

export function PageHeader({ title }: Props) {
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4">
      <button
        type="button"
        onClick={goHome}
        className="rounded-2xl border border-emerald-300/14 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50"
      >
        AI Core
      </button>

      <div className="text-center text-[10px] uppercase tracking-[0.18em] text-white/35">
        {title}
      </div>

      <div className="h-10 w-[76px]" aria-hidden="true" />
    </div>
  );
}
