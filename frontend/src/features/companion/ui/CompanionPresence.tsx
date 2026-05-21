import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = { compact?: boolean };

export function CompanionPresence({ compact = false }: Props) {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const [state, setState] = useState<CompanionStateDto | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getState().then((next) => {
      if (mounted) setState(next);
    }).catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  const message = state?.message || 'Готов помочь с расходами, доходами и вопросами по деньгам.';

  if (compact) {
    return <CompanionButton mood={state?.mood ?? 'idle'} onClick={() => openAIWithCommand()} label="Открыть AI" />;
  }

  return (
    <section className="app-card" data-no-swipe="true">
      <div className="grid grid-cols-[96px_1fr] items-center gap-4">
        <CompanionButton size="lg" mood={state?.mood ?? 'idle'} onClick={() => openAIWithCommand()} label="Открыть AI" />
        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-[-0.03em] text-white">Финансовый помощник</div>
          <p className="mt-2 text-sm leading-6 text-white/56">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="app-mini-pill">Уровень {state?.level ?? 1}</span>
            <span className="app-mini-pill">Серия {state?.streakDays ?? 0} дн.</span>
            <span className="app-mini-pill">Опыт {state?.xp ?? 0}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
