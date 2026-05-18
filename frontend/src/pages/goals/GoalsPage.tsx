import { useNavigationStore } from '@/features/navigation/model/navigation.store';

const goals = [
  { title: 'Подушка безопасности', value: '50 000 ₽', progress: 42, note: 'Спокойная долгосрочная цель' },
  { title: 'Переезд', value: '180 000 ₽', progress: 18, note: 'Без давления и fake urgency' },
  { title: 'Инвестиционный старт', value: '30 000 ₽', progress: 7, note: 'После стабилизации расходов' },
];

export default function GoalsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Goals</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Финансовый рост</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Цели должны работать как calm progression, не как казино с наградами.</p>
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
              <div className="mt-4 h-2 rounded-full bg-white/8"><div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${goal.progress}%` }} /></div>
              <div className="mt-2 text-xs text-white/42">{goal.progress}%</div>
            </section>
          ))}
        </div>

        <button onClick={() => navigateTo('ai-core')} className="w-full rounded-[26px] border border-emerald-300/14 bg-emerald-300/10 p-4 text-left">
          <div className="font-semibold text-emerald-50">Создать цель через AI</div>
          <div className="mt-1 text-sm text-emerald-50/55">Например: “создай цель ноутбук 120000”.</div>
        </button>
      </div>
    </div>
  );
}
