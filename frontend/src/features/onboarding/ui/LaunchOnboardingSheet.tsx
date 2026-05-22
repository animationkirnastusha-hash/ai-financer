import { useEffect } from 'react';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

const steps = [
  ['1', 'Позови помощника', 'Скажи “Фина”, затем обычную финансовую команду.'],
  ['2', 'Проверь превью', 'Деньги, счета и цели не меняются без подтверждения.'],
  ['3', 'Подтверди или уточни', 'Можно ответить коротко: “да”, “нет”, “отмени”, “на карту”.'],
];

const examples = [
  'Фина, у меня есть 10к наличными',
  'Фина, кофе 350 с карты',
  'Фина, создай цель отпуск 120000',
];

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const close = useOnboardingStore((state) => state.close);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runExample = (command: string) => {
    close();
    openAIWithCommand(command);
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true" data-ai-core-modal="true">
      <div className="app-modal-sheet max-w-[560px]" data-no-swipe="true" data-ai-core-modal="true">
        <div className="app-modal-handle" />

        <div className="app-modal-body space-y-4">
          <section className="rounded-[30px] border border-emerald-300/15 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_48%),rgba(255,255,255,0.04)] p-5">
            <div className="app-eyebrow">Первый запуск</div>
            <h2 className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.055em] text-white">
              Голосовые финансы без лишних кнопок
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Основной сценарий простой: позови помощника, скажи задачу, проверь действие и подтверди. Текстовый ввод останется запасным вариантом.
            </p>
          </section>

          <section className="grid gap-3">
            {steps.map(([step, title, description]) => (
              <div key={step} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <div className="grid h-8 w-8 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-sm font-semibold text-emerald-100">
                  {step}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug text-white">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-white/45">{description}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-[26px] border border-white/8 bg-black/20 p-4">
            <div className="app-eyebrow">Примеры</div>
            <div className="mt-3 grid gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => runExample(example)}
                  className="rounded-[18px] border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-3 text-left text-xs leading-5 text-emerald-100/90 transition active:scale-[0.99]"
                >
                  {example}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="app-modal-footer">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => {
                close();
                openAIWithCommand('Фина, создай первый счет');
              }}
              className="app-primary-button w-full"
            >
              Начать с первого счёта
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                navigateTo('dashboard');
              }}
              className="app-secondary-button w-full"
            >
              Сначала посмотреть главную
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
