type QuickPrompt = {
  label: string;
  command: string;
  description: string;
};

type Props = {
  onRunCommand: (command: string) => void;
};

const prompts: QuickPrompt[] = [
  {
    label: 'Расход',
    command: 'кофе 300',
    description: 'Записать трату обычной фразой.',
  },
  {
    label: 'Доход',
    command: 'доход 50000 на основной счет',
    description: 'Добавить поступление с проверкой.',
  },
  {
    label: 'Перевод',
    command: 'переведи 3000 с карты на накопительный',
    description: 'Подготовить безопасный перевод.',
  },
  {
    label: 'Аналитика',
    command: 'сколько я потратил за неделю',
    description: 'Получить понятный финансовый ответ.',
  },
  {
    label: 'Настройки',
    command: 'включи строгий финансовый режим',
    description: 'Изменить поведение помощника языком.',
  },
  {
    label: 'Счёт',
    command: 'создай счет отпуск',
    description: 'Создать финансовую структуру.',
  },
];

export function AICoreQuickPrompts({ onRunCommand }: Props) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Быстрые команды</div>
          <div className="mt-1 text-xs leading-5 text-white/42">
            Примеры не являются шаблонами. Фина разберёт смысл, покажет проверку и попросит подтверждение там, где это нужно.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.command}
            type="button"
            onClick={() => onRunCommand(prompt.command)}
            className="rounded-[22px] border border-white/8 bg-black/18 p-3 text-left transition active:scale-[0.98]"
          >
            <div className="text-sm font-medium text-white">{prompt.label}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/38">{prompt.description}</div>
            <div className="mt-3 truncate rounded-full bg-emerald-300/[0.08] px-2.5 py-1 text-[11px] text-emerald-100/75">
              “{prompt.command}”
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
