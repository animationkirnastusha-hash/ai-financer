type Props = {
  open: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => void;
};

const capabilities = [
  'Создание счетов, доходов, расходов и переводов',
  'Настройка разделов и категорий',
  'Распределение операций по смыслу',
  'Переходы по экранам приложения',
];

export function CommandListSheet({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm" data-no-swipe="true">
      <div className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                AI
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Возможности AI
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6 text-xl text-white"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/58">
            AI не требует точных шаблонов. Пиши или говори обычными словами — приложение подготовит понятное действие и покажет подтверждение.
          </p>

          <div className="mt-5 grid gap-3">
            {capabilities.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white/75"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
