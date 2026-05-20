import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { PageHeader } from '@/shared/ui/PageHeader';

const goals = [
  { title: 'Подушка безопасности', value: '50 000 ₽', progress: 42, note: 'Запас на спокойный месяц.' },
  { title: 'Переезд', value: '180 000 ₽', progress: 18, note: 'Длинная цель без давления.' },
  { title: 'Инвестиционный старт', value: '30 000 ₽', progress: 7, note: 'После стабилизации расходов.' },
];

export default function GoalsPage() {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Цели" subtitle="Финансовый рост" />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="mx-auto max-w-[620px] space-y-4">
          <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Цели</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Финансовые цели</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Сохраняй деньги на важные вещи и следи за прогрессом без лишнего давления.
            </p>
          </header>

          <div className="space-y-3">
            {goals.map((goal) => (
              <section key={goal.title} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{goal.title}</div>
                    <div className="mt-1 text-sm text-white/45">{goal.note}</div>
                  </div>
                  <div className="text-sm text-emerald-100/80">{goal.value}</div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/8">
                  <div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${goal.progress}%` }} />
                </div>
                <div className="mt-2 text-xs text-white/42">{goal.progress}%</div>
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openAIWithCommand('создай цель ноутбук 120000')}
            className="w-full rounded-[26px] border border-emerald-300/14 bg-emerald-300/10 p-4 text-left"
          >
            <div className="font-semibold text-emerald-50">Создать цель через AI</div>
            <div className="mt-1 text-sm text-emerald-50/55">Например: «создай цель ноутбук 120000».</div>
          </button>
        </div>
      </div>
    </div>
  );
}
