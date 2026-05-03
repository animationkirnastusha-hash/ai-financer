type Props = {
  onCreate: () => void;
};

export function EmptyAccountsState({ onCreate }: Props) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-center">
      <div className="text-lg font-medium text-white">
        Нет счетов
      </div>

      <div className="mt-2 text-sm text-white/60">
        Добавь счёт через AI
      </div>

      <button
        onClick={onCreate}
        className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15"
      >
        Создать через AI
      </button>
    </div>
  );
}