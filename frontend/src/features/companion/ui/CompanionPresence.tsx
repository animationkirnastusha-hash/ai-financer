import { useEffect, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = { compact?: boolean };

export function CompanionPresence({ compact = false }: Props) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
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
  const xp = state?.xp ?? 0;
  const nextXp = Math.max(1000, Math.ceil((xp + 1) / 1000) * 1000);
  const progress = Math.min(100, Math.max(6, Math.round((xp / nextXp) * 100)));

  if (compact) {
    return <CompanionButton mood={state?.mood ?? 'idle'} onClick={() => openAIWithCommand()} label="Открыть AI" />;
  }

  return (
    <section className="app-card app-companion-card" data-no-swipe="true">
      <div className="app-companion-card__avatar">
        <CompanionButton size="lg" mood={state?.mood ?? 'idle'} onClick={() => navigateTo('companion')} label="Открыть помощника" />
      </div>

      <div className="app-companion-card__content">
        <div className="app-companion-card__kicker">Помощник</div>
        <div className="app-companion-card__title">Финансовый помощник</div>
        <p className="app-companion-card__message">{message}</p>

        <div className="app-companion-card__stats">
          <span>Уровень {state?.level ?? 1}</span>
          <span>Серия {state?.streakDays ?? 0} дн.</span>
          <span>{xp} XP</span>
        </div>

        <div className="app-companion-card__xp" aria-label={`Опыт ${xp} из ${nextXp}`}>
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
