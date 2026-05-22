import { useEffect, useMemo, useState } from 'react';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useSettingsStore } from '@/features/settings/model/settings.store';

function progressPercent(xp: number, level: number) {
  const base = Math.max(0, (level - 1) * 100);
  const next = Math.max(100, level * 100);
  return Math.max(4, Math.min(100, Math.round(((xp - base) / Math.max(1, next - base)) * 100)));
}

export default function CompanionPage() {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoiceRepliesEnabled = useSettingsStore((state) => state.setVoiceRepliesEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const [state, setState] = useState<CompanionStateDto | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getState().then((next) => mounted && setState(next)).catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  const level = Number(state?.level ?? 1);
  const xp = Number(state?.xp ?? 0);
  const streak = Number(state?.streakDays ?? 0);
  const progress = progressPercent(xp, level);

  const nextHint = useMemo(() => {
    if (streak >= 7) return 'Серия уже держится. Следующий шаг — цели и регулярность.';
    if (xp > 0) return 'Запиши ещё одну операцию или создай цель, чтобы усилить прогресс.';
    return 'Начни с первой операции: “кофе 300” или “доход 50000”.';
  }, [streak, xp]);

  const memoryItems = [
    'последние финансовые действия',
    'частые счета и категории',
    'цели, серии и привычки',
    'уточнения внутри финансового сценария',
  ];

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Помощник" left="back" right={['home', 'settings']} />

        <section className="app-card app-card--hero app-companion-page-hero">
          <div className="app-companion-page-hero__avatar">
            <CompanionButton size="lg" mood={state?.mood ?? 'idle'} label="Помощник" />
          </div>
          <div className="app-eyebrow">Companion</div>
          <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.06em]">Финансовый компаньон</h1>
          <p className="mt-3 text-sm leading-6 text-white/58">
            {state?.message || 'Помогает записывать действия, держать ритм и видеть финансовое состояние без лишнего шума.'}
          </p>
        </section>

        <section className="app-card app-progression-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="app-section-title">Прогресс</div>
              <div className="mt-1 text-sm text-white/45">XP станет отдельным ресурсом позже. Сейчас он показывает устойчивость привычки.</div>
            </div>
            <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/10 px-3 py-2 text-right">
              <div className="text-lg font-semibold text-emerald-50">{xp}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/50">XP</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="app-mini-stat"><span>Уровень</span><b>{level}</b></div>
            <div className="app-mini-stat"><span>Серия</span><b>{streak} дн.</b></div>
            <div className="app-mini-stat"><span>Статус</span><b>{state?.mood ?? 'idle'}</b></div>
          </div>

          <div className="mt-5 app-xp-panel app-xp-panel--large">
            <div className="app-xp-panel__top"><span>До следующего уровня</span><b>{progress}%</b></div>
            <div className="app-xp-panel__track"><i style={{ width: `${progress}%` }} /></div>
            <div className="app-xp-panel__caption">{nextHint}</div>
          </div>
        </section>

        <section className="app-card">
          <div className="app-section-title">Голос</div>
          <div className="mt-4 space-y-3">
            <label className="app-toggle-row">
              <span><span>Голос всегда готов</span><small>Companion слушает короткие команды, пока приложение открыто.</small></span>
              <input type="checkbox" checked={voiceAlwaysOnEnabled} onChange={(event) => setVoiceAlwaysOnEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Ответы голосом</span><small>Коротко озвучивать ответы. Можно выключить, чтобы не мешало.</small></span>
              <input type="checkbox" checked={voiceRepliesEnabled} onChange={(event) => setVoiceRepliesEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Текстовое поле</span><small>Оставить запасной способ ввода, если говорить неудобно.</small></span>
              <input type="checkbox" checked={textInputEnabled} onChange={(event) => setTextInputEnabled(event.target.checked)} />
            </label>
          </div>
        </section>

        <section className="app-card">
          <div className="app-section-title">Что я учитываю</div>
          <div className="mt-4 grid gap-2">
            {memoryItems.map((item) => <div key={item} className="app-check-row">{item}</div>)}
          </div>
          <p className="mt-4 text-sm leading-6 text-white/44">Нефинансовые разговоры могут получить короткий ответ, но не сохраняются в долгую память.</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button type="button" className="app-action-card" onClick={() => openAIWithCommand('что изменилось за месяц?')}>
            <span>Спросить AI</span>
            <small>Короткий финансовый вопрос</small>
          </button>
          <button type="button" className="app-action-card" onClick={() => navigateTo('goals')}>
            <span>Цели</span>
            <small>Прогресс и накопления</small>
          </button>
        </section>
      </div>
    </div>
  );
}
