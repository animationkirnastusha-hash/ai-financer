import { useEffect } from 'react';
import { useProgressionStore } from '@/features/progression/model/progression.store';

function nextLevelXP(level: number) {
  return Math.max(100, level * level * 75);
}

export function ProgressionMiniCard() {
  const { snapshot, isLoading, load } = useProgressionStore();

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading && !snapshot) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
        Загружаю прогресс…
      </div>
    );
  }

  if (!snapshot) return null;

  const targetXP = nextLevelXP(snapshot.level);
  const progress = Math.min(100, Math.round((snapshot.xp / targetXP) * 100));

  return (
    <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/55">Progression</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Уровень {snapshot.level}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
          <p className="text-xs text-white/50">Streak</p>
          <p className="text-sm font-semibold text-white">{snapshot.streakDays} дн.</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-300 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/55">
        <span>{snapshot.xp} XP</span>
        <span>AI companion: {snapshot.companionLevel}</span>
      </div>
    </section>
  );
}
