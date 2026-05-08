type Props = {
  onRunCommand: (command: string) => void | Promise<void>;
};

const groups = [
  {
    title: 'Деньги',
    prompts: [
      {
        label: 'Доход',
        example: '+50000 зарплата',
        command: '+50000 зарплата',
      },
      {
        label: 'Расход',
        example: 'кофе 350',
        command: 'кофе 350',
      },
      {
        label: 'Перевод',
        example: 'переведи 5000 с карты на накопления',
        command: 'переведи 5000 с карты на накопления',
      },
    ],
  },
  {
    title: 'Разделы',
    prompts: [
      {
        label: 'Создать раздел',
        example: 'создай раздел Дом',
        command: 'создай раздел Дом',
      },
      {
        label: 'Распределить',
        example: 'запиши продукты в раздел Дом',
        command: 'запиши все расходы по продуктам в раздел Дом',
      },
      {
        label: 'Правило',
        example: 'Steam всегда в Игры',
        command: 'все траты из Steam отправляй в Игры',
      },
    ],
  },
  {
    title: 'Счета',
    prompts: [
      {
        label: 'Создать счёт',
        example: 'создай долларовый счёт на 5000',
        command: 'создай долларовый счёт на 5000',
      },
      {
        label: 'Показать счета',
        example: 'покажи мои счета',
        command: 'покажи мои счета',
      },
      {
        label: 'Расходы месяца',
        example: 'сколько я потратил',
        command: 'сколько я потратил в этом месяце',
      },
    ],
  },
];

export function AICoreQuickPrompts({ onRunCommand }: Props) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            AI команды
          </div>

          <p className="mt-2 text-xs leading-5 text-white/42">
            Это примеры фраз. Можно писать по-своему — AI сам поймёт действие.
          </p>
        </div>

        <div className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-100/75">
          Base
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/28">
              {group.title}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {group.prompts.map((prompt) => (
                <button
                  key={prompt.command}
                  type="button"
                  onClick={() => onRunCommand(prompt.command)}
                  className="min-w-[158px] rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left active:scale-[0.98]"
                >
                  <div className="text-sm font-medium text-white">
                    {prompt.label}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-emerald-100/80">
                    {prompt.example}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
