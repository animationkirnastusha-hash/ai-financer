import { navigationCommands } from '@/features/commands/model/commandCatalog';

type Props = {
  open: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => void;
};

const groupLabels = {
  money: 'Деньги',
  analysis: 'Аналитика',
  navigation: 'Навигация',
} as const;

export function CommandListSheet({ open, onClose, onRunCommand }: Props) {
  if (!open) return null;

  const groups = navigationCommands.reduce(
    (acc, item) => {
      acc[item.group] = [...(acc[item.group] || []), item];
      return acc;
    },
    {} as Record<string, typeof navigationCommands>,
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Examples
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Что можно сказать AI
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

          <p className="mt-3 text-sm leading-6 text-white/55">
            Это не жёсткие шаблоны. Это примеры естественных фраз — можно
            писать и говорить по-своему.
          </p>

          <div className="mt-5 space-y-5">
            {(['money', 'analysis', 'navigation'] as const).map((group) => {
              const items = groups[group] || [];

              if (items.length === 0) return null;

              return (
                <section key={group}>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
                    {groupLabels[group]}
                  </div>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onRunCommand(item.command);
                          onClose();
                        }}
                        className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left transition active:scale-[0.99] hover:bg-white/[0.06]"
                      >
                        <div className="text-sm font-medium text-white">
                          {item.label}
                        </div>

                        <div className="mt-1 text-xs leading-5 text-white/45">
                          {item.description}
                        </div>

                        <div className="mt-3 rounded-xl border border-emerald-300/10 bg-emerald-300/8 px-3 py-2 text-xs leading-5 text-emerald-100/85">
                          {item.command}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}