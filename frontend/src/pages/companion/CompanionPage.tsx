import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { PageHeader } from '@/shared/ui/PageHeader';

export default function CompanionPage() {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const [state, setState] = useState<CompanionStateDto | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getState().then((next) => mounted && setState(next));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Помощник" subtitle="AI-компаньон" />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="mx-auto max-w-[620px] space-y-4">
          <section className="rounded-[38px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,183,0.14),transparent_44%),rgba(255,255,255,0.045)] p-6 text-center">
            <div className="mx-auto flex justify-center"><CompanionButton size="lg" mood={state?.mood} /></div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-emerald-200/60">Помощник</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Финансовый компаньон</h1>
            <p className="mx-auto mt-3 max-w-[460px] text-sm leading-6 text-white/55">
              {state?.message || 'Я рядом, чтобы помогать с расходами, счетами и понятными финансовыми решениями.'}
            </p>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.level ?? 1}</div><div className="mt-1 text-xs text-white/42">Уровень</div></div>
            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.streakDays ?? 0}</div><div className="mt-1 text-xs text-white/42">Серия</div></div>
            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-center"><div className="text-2xl font-semibold">{state?.xp ?? 0}</div><div className="mt-1 text-xs text-white/42">XP</div></div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-lg font-semibold">Состояние</div>
            <div className="mt-4 space-y-2 text-sm text-white/58">
              <p>Серия {state?.streakDays ?? 0} дней.</p>
              <p>Последние операции учтены.</p>
              <p>Можно спросить AI о расходах, счетах или целях.</p>
            </div>
          </section>

          <button onClick={() => openAIWithCommand()} className="w-full rounded-[26px] border border-emerald-300/14 bg-emerald-300/10 p-4 text-left">
            <div className="font-semibold text-emerald-50">Открыть AI</div>
            <div className="mt-1 text-sm text-emerald-50/55">Напиши команду или зажми помощника для голоса.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
