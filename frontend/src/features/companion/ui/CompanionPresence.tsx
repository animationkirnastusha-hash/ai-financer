import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = { compact?: boolean };

export function CompanionPresence({ compact = false }: Props) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
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
    return <CompanionButton mood={state?.mood ?? 'idle'} onClick={() => navigateTo('companion')} label="Открыть помощника" />;
  }

  return (
    <section className="app-card app-companion-card" data-no-swipe="true">
      <div className="app-companion-card__avatar">
        <CompanionButton size="lg" mood={state?.mood ?? 'idle'} onClick={() => navigateTo('companion')} label="Открыть помощника" />
      </div>

      <div className="app-companion-card__body">
        <div className="app-companion-card__title">Финансовый помощник</div>
        <p className="app-companion-card__text">{message}</p>
        <div className="app-companion-card__meta">
          <span className="app-mini-pill">Уровень {state?.level ?? 1}</span>
          <span className="app-mini-pill">Серия {state?.streakDays ?? 0} дн.</span>
          <span className="app-mini-pill">Опыт {state?.xp ?? 0}</span>
        </div>
      </div>
    </section>
  );
}
