import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  compact?: boolean;
};

export function CompanionPresence({ compact = false }: Props) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const [state, setState] = useState<CompanionStateDto | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getState().then((next) => {
      if (mounted) setState(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const message = state?.message || 'Серия и прогресс появятся после первых действий.';

  if (compact) {
    return <CompanionButton mood={state?.mood} onClick={() => navigateTo('companion')} />;
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl">
      <div className="flex items-center gap-4">
        <CompanionButton size="lg" mood={state?.mood} onClick={() => navigateTo('companion')} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/60">Companion</div>
          <div className="mt-1 text-lg font-semibold text-white">Спокойный финансовый ритм</div>
          <p className="mt-1 text-sm leading-6 text-white/58">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Level {state?.level ?? 1}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Серия {state?.streakDays ?? 0} дн.</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{state?.xp ?? 0} XP</span>
          </div>
        </div>
      </div>
    </section>
  );
}
