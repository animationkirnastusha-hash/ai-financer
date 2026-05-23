import { useEffect } from 'react';
import { useProgressionStore } from '@/features/progression/model/progression.store';

function nextLevelXP(level: number) {
  return Math.max(100, level * level * 75);
}

function formatXP(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export function ProgressionMiniCard() {
  const { snapshot, isLoading, load } = useProgressionStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading && !snapshot) {
    return (
      <section className="app-card app-xp-hero">
        <div className="app-eyebrow">XP</div>
        <div className="app-xp-hero__title">Загружаю прогресс…</div>
      </section>
    );
  }

  if (!snapshot) return null;

  const targetXP = nextLevelXP(snapshot.level);
  const progress = Math.min(100, Math.round((snapshot.xp / targetXP) * 100));
  const xpLeft = Math.max(0, targetXP - snapshot.xp);

  return (
    <section className="app-card app-xp-hero" onClick={() => load(true)} role="button" tabIndex={0}>
      <div className="app-xp-hero__head">
        <div className="min-w-0">
          <div className="app-eyebrow">XP ресурс</div>
          <div className="app-xp-hero__title">Уровень {snapshot.level}. Опыт копится за реальные действия.</div>
        </div>
        <div className="app-xp-hero__badge">
          <b>{formatXP(snapshot.xp)}</b>
          <span>XP</span>
        </div>
      </div>

      <div className="app-xp-hero__grid">
        <div className="app-xp-hero__stat"><span>До уровня</span><b>{formatXP(xpLeft)}</b></div>
        <div className="app-xp-hero__stat"><span>Серия</span><b>{snapshot.streakDays} дн.</b></div>
        <div className="app-xp-hero__stat"><span>Фина</span><b>{snapshot.companionLevel}</b></div>
      </div>

      <div className="mt-4 app-xp-panel">
        <div className="app-xp-panel__top"><span>Прогресс уровня</span><b>{progress}%</b></div>
        <div className="app-xp-panel__track"><i style={{ width: `${progress}%` }} /></div>
        <div className="app-xp-panel__caption">Позже XP можно будет использовать как ресурс для преимуществ и наград.</div>
      </div>
    </section>
  );
}
