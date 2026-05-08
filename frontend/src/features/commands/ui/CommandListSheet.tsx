type Props = {
  open: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => void;
};

const items = [
  {
    title: 'AI Core',
    description: 'Вернуться к главному AI-экрану',
    command: 'открой главный экран',
  },
  {
    title: 'Счета',
    description: 'Открыть счета и баланс',
    command: 'открой счета',
  },
  {
    title: 'История',
    description: 'Открыть все операции',
    command: 'открой историю операций',
  },
  {
    title: 'Разделы и категории',
    description: 'Настроить структуру расходов',
    command: 'открой разделы и категории',
  },
  {
    title: 'Настройки',
    description: 'Открыть настройки приложения',
    command: 'открой настройки',
  },
];

export function CommandListSheet({ open, onClose, onRunCommand }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/60 px-3 pb-3 backdrop-blur-sm" data-no-swipe="true">
      <div className="mx-auto max-h-[86dvh] w-full max-w-[560px] overflow-y-auto rounded-[30px] border border-white/10 bg-[#0b1016] p-4 text-white shadow-2xl no-scrollbar">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Меню</div>
            <div className="mt-1 text-lg font-semibold text-white">Быстрый переход</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-white/75"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                onRunCommand(item.command);
                onClose();
              }}
              className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left transition active:scale-[0.99]"
            >
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-white/45">{item.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
