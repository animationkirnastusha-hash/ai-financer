import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  title: string;
  onBack?: () => void;
};

export function PageHeader({ title, onBack }: Props) {
  const openGlobalCommandList = useNavigationStore(
    (state) => state.openGlobalCommandList,
  );

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
          >
            Назад
          </button>
        ) : null}

        <button
          type="button"
          onClick={openGlobalCommandList}
          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
        >
          Команды
        </button>
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
        {title}
      </div>
    </div>
  );
}