import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

const examples = [
  'я купил кофе за 350 с карты',
  'мне пришла зарплата 50000 на основной счёт',
  'переведи 3000 с карты на накопительный',
];

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const close = useOnboardingStore((state) => state.close);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  if (!isOpen) return null;

  const runExample = (command: string) => {
    close();
    openAIWithCommand(command);
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 px-3 backdrop-blur-sm">
      <div className="flex h-full items-end">
        <div className="mx-auto mb-3 flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-[34px] border border-white/10 bg-[#0b1016] text-white shadow-2xl">
          <div className="shrink-0 px-4 pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="rounded-[30px] border border-emerald-300/15 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_48%),rgba(255,255,255,0.04)] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                AI-financer
              </div>

              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                Управляй деньгами через AI
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/62">
                Пиши или говори обычными словами. AI поймёт доход, расход,
                перевод, счёт или статистику — и покажет безопасное подтверждение.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {[
                ['1', 'Скажи или напиши действие', 'Не нужно помнить шаблоны.'],
                ['2', 'AI покажет превью', 'Деньги не меняются без проверки.'],
                ['3', 'Подтверди результат', 'После confirm обновятся счета и история.'],
              ].map(([step, title, description]) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-sm text-emerald-100">
                    {step}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-white/45">
                      {description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Попробуй так
              </div>

              <div className="mt-3 space-y-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => runExample(example)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-left text-xs leading-5 text-emerald-100/90 transition active:scale-[0.99]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-white/8 bg-[#0b1016]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-xl">
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  close();
                  openAIWithCommand('создай первый счет');
                }}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-400/16 px-4 py-4 text-sm font-medium text-white"
              >
                Начать с первого счёта
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  navigateTo('dashboard');
                }}
                className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/55"
              >
                Сначала посмотреть Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
