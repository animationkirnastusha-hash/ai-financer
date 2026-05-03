type Props = {
  onRunCommand: (command: string) => void | Promise<void>;
};

const prompts = [
  {
    label: 'Записать доход',
    example: '+50000 зарплата',
    command: '+50000 зарплата',
  },
  {
    label: 'Записать расход',
    example: 'кофе 350',
    command: 'кофе 350',
  },
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
    label: 'Спросить расходы',
    example: 'сколько я потратил',
    command: 'сколько я потратил в этом месяце',
  },
];

export function AICoreQuickPrompts({ onRunCommand }: Props) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
        Примеры для AI
      </div>

      <p className="mt-2 text-xs leading-5 text-white/42">
        Это не кнопки управления. Это примеры фраз — можно говорить по-своему.
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {prompts.map((prompt) => (
          <button
            key={prompt.command}
            type="button"
            onClick={() => onRunCommand(prompt.command)}
            className="min-w-[150px] rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left active:scale-[0.98]"
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
    </section>
  );
}