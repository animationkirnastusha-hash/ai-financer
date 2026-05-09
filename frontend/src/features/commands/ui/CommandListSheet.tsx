type Props = {
  open: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => void;
};

export function CommandListSheet({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                AI Core
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Говори естественно
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
            >
              Закрыть
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-emerald-300/10 bg-emerald-300/[0.06] p-4 text-sm leading-6 text-white/72">
            AI понимает не шаблоны, а смысл: счета, доходы, расходы, переводы, категории,
            разделы и настройки. Пиши так, как удобно тебе. Перед выполнением важные
            действия можно проверить и исправить вручную.
          </div>
        </div>
      </div>
    </div>
  );
}
