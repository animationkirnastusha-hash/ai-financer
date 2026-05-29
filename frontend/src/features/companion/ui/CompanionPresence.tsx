import { useEffect, useMemo, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = { compact?: boolean };

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(4, Math.min(100, Math.round(value)));
}

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

  const xp = Number(state?.xp ?? 0);
  const level = Number(state?.level ?? 1);
  const currentLevelBase = Math.max(0, (level - 1) * 100);
  const nextLevelBase = level * 100;
  const progress = clampPercent(((xp - currentLevelBase) / Math.max(1, nextLevelBase - currentLevelBase)) * 100);
  const message = state?.message || 'Готова помогать с расходами, счетами, целями и привычками.';

  const status = useMemo(() => {
    const streak = Number(state?.streakDays ?? 0);
    if (streak >= 7) return `Серия ${streak} дней. XP копится быстрее.`;
    if (xp > 0) return `До следующего уровня: ${Math.max(0, nextLevelBase - xp)} XP.`;
    return 'XP появится после первых действий.';
  }, [nextLevelBase, state?.streakDays, xp]);

  if (compact) {
    return <CompanionButton mood={state?.mood ?? 'idle'} onClick={() => navigateTo('companion')} label="Помощник" />;
  }

  return (
    <section className="app-card app-companion-presence" data-no-swipe="true">
      <div className="app-companion-presence__main">
        <button type="button" className="app-companion-presence__avatar" onClick={() => navigateTo('companion')} aria-label="Открыть помощника">
          <CompanionButton size="lg" mood={state?.mood ?? 'idle'} label="Помощник" />
        </button>

        <div className="app-companion-presence__content">
          <div className="app-eyebrow">Помощник</div>
          <div className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">Финансовый компаньон</div>
          <p className="mt-2 text-sm leading-6 text-white/58">{message}</p>

          <div className="mt-4 app-xp-panel">
            <div className="app-xp-panel__top">
              <span>Уровень {level}</span>
              <b>{xp} XP</b>
            </div>
            <div className="app-xp-panel__track"><i style={{ width: `${progress}%` }} /></div>
            <div className="app-xp-panel__caption">{status}</div>
            <div className="app-xp-panel__future">Скоро XP станет ресурсом</div>
          </div>
        </div>
      </div>

      <div className="app-companion-presence__actions">
        <button type="button" onClick={() => navigateTo('companion')} className="app-secondary-button">Открыть прогресс</button>
      </div>
    </section>
  );
}
