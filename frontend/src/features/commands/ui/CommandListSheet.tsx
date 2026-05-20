import { navigationCommands } from '@/features/commands/model/commandCatalog';

const groupLabels = {
  money: 'Деньги',
  organization: 'Структура',
  analysis: 'Аналитика',
  navigation: 'Навигация',
  settings: 'Настройки',
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => void;
};

export function CommandListSheet({ open, onClose, onRunCommand }: Props) {
  if (!open) return null;

  const groupedCommands = navigationCommands.reduce<Record<string, typeof navigationCommands>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  const runCommand = (command: string) => {
    onRunCommand(command);
    onClose();
  };

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
            AI понимает не шаблоны, а смысл: счета, доходы, расходы, переводы,
            аналитику, настройки и навигацию. Выбери пример или напиши свою фразу.
          </div>

          <div className="mt-5 space-y-5">
            {Object.entries(groupedCommands).map(([group, items]) => (
              <section key={group}>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
                  {groupLabels[group as keyof typeof groupLabels] ?? group}
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => runCommand(item.command)}
                      className="w-full rounded-[22px] border border-white/8 bg-white/[0.045] p-4 text-left transition active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-white/45">{item.description}</div>
                          <div className="mt-3 truncate rounded-full bg-black/25 px-3 py-1.5 text-xs text-emerald-100/72">
                            “{item.command}”
                          </div>
                        </div>
                        <span className="mt-0.5 text-white/28">↗</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
