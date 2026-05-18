import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export default function CompanionPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const [state, setState] = useState<CompanionStateDto | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getState().then((next) => mounted && setState(next));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <section className="rounded-[38px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,183,0.14),transparent_44%),rgba(255,255,255,0.045)] p-6 text-center">
          <div className="mx-auto flex justify-center"><CompanionButton size="lg" mood={state?.mood} /></div>
          <div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-emerald-200/60">AI Companion</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Живой интерфейс, не маскот</h1>
          <p className="mx-auto mt-3 max-w-[460px] text-sm leading-6 text-white/55">{state?.message || 'Компаньон должен усиливать trust, clarity, calmness и control. Без аниме, крика и dopamine spam.'}</p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.level ?? 1}</div><div className="mt-1 text-xs text-white/42">Level</div></div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.streakDays ?? 0}</div><div className="mt-1 text-xs text-white/42">Streak</div></div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.xp ?? 0}</div><div className="mt-1 text-xs text-white/42">XP</div></div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Правильное поведение</div>
          <div className="mt-4 space-y-2 text-sm text-white/58">
            <p>Серия 6 дней. Хороший темп.</p>
            <p>На этой неделе расходы стали стабильнее.</p>
            <p>Похоже, ты стал внимательнее относиться к тратам.</p>
          </div>
        </section>

        <button onClick={() => navigateTo('ai-core')} className="w-full rounded-[26px] border border-emerald-300/14 bg-emerald-300/10 p-4 text-left">
          <div className="font-semibold text-emerald-50">Открыть AI input</div>
          <div className="mt-1 text-sm text-emerald-50/55">Tap companion → command input. Hold later → voice mode.</div>
        </button>
      </div>
    </div>
  );
}
