import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  title: string;
  onBack?: () => void;
};

export function PageHeader({ title, onBack }: Props) {
  const goHome = useNavigationStore((state) => state.goHome);
  const handleBack = onBack ?? goHome;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/72"
      >
        Назад
      </button>

      <div className="text-center text-[10px] uppercase tracking-[0.18em] text-white/35">
        {title}
      </div>

      <div className="h-10 w-[66px]" aria-hidden="true" />
    </div>
  );
}
