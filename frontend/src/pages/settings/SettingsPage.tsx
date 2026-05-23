import { useState } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api';

export default function SettingsPage() {
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<DataResetMode | null>(null);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);
  const voiceWakeWordEnabled = useSettingsStore((state) => state.voiceWakeWordEnabled);
  const voiceActiveWindowSeconds = useSettingsStore((state) => state.voiceActiveWindowSeconds);
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const setVoiceWakeWordEnabled = useSettingsStore((state) => state.setVoiceWakeWordEnabled);
  const setVoiceActiveWindowSeconds = useSettingsStore((state) => state.setVoiceActiveWindowSeconds);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setVoiceRepliesEnabled = useSettingsStore((state) => state.setVoiceRepliesEnabled);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);


  const handleReset = async (mode: DataResetMode) => {
    const text = mode === 'finance'
      ? 'Очистить все финансовые данные? XP, уровень и прогресс останутся.'
      : 'Сбросить всё по аккаунту? Финансы, XP, уровень, достижения и прогресс будут обнулены. Профиль останется.';

    if (!window.confirm(text)) return;

    setResetMode(mode);
    setResetStatus(null);

    try {
      await dataResetApi.resetMe(mode);
      setResetStatus(mode === 'finance' ? 'Финансовые данные очищены.' : 'Аккаунт обнулён.');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : 'Не удалось выполнить сброс.');
    } finally {
      setResetMode(null);
    }
  };

  const navigationItems = [
    { title: 'Счета', caption: 'Баланс и основные счета', screen: 'accounts' as const },
    { title: 'Цели', caption: 'Накопления и планы', screen: 'goals' as const },
    { title: 'Помощник', caption: 'Голос, реакции и прогресс', screen: 'companion' as const },
    { title: 'Разделы', caption: 'Категории и структура', screen: 'taxonomy-settings' as const },
    { title: 'Рефералы', caption: 'Код и приглашения', screen: 'referral' as const },
    { title: 'Премиум', caption: 'Расширенные возможности', screen: 'premium' as const },
  ];

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Настройки" left="back" right={['home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Настройки</div>
          <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.055em]">Управление</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">Голос, язык, AI и структура приложения.</p>
        </header>

        <section className="app-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="app-section-title">Язык</div>
              <div className="mt-1 text-sm text-white/42">Русский или English.</div>
            </div>
            <LanguageSwitcher />
          </div>
        </section>

        <section className="app-card">
          <div className="app-section-title">Голос и AI</div>

          <div className="voice-settings-card mt-4">
            <div className="voice-settings-card__head">
              <span className="voice-settings-card__badge">Фина</span>
              <div>
                <div className="text-sm font-semibold text-white">Имя помощника фиксировано</div>
                <div className="mt-1 text-xs leading-5 text-white/46">Пользователь всегда зовёт Фину. Так меньше путаницы в обучении, голосе и подсказках.</div>
              </div>
            </div>
            <div className="voice-settings-example">
              Пример: “Фина, кофе 300”. Без имени команда не уйдёт в AI.
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="app-toggle-row">
              <span><span>Голосовой ввод</span><small>Разрешает управление через помощника.</small></span>
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Микрофон включён</span><small>Пока приложение открыто, помощник ждёт имя.</small></span>
              <input type="checkbox" checked={voiceAlwaysOnEnabled} onChange={(event) => setVoiceAlwaysOnEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Ключевая фраза</span><small>Боевой режим начинается только после имени помощника.</small></span>
              <input type="checkbox" checked={voiceWakeWordEnabled} onChange={(event) => setVoiceWakeWordEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Бета-режим голоса</span><small>Включает экспериментальную обработку голосовых команд.</small></span>
              <input type="checkbox" checked={voiceBetaEnabled} onChange={(event) => setVoiceBetaEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Ответы голосом</span><small>Помощник может коротко озвучивать ответ.</small></span>
              <input type="checkbox" checked={voiceRepliesEnabled} onChange={(event) => setVoiceRepliesEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Текстовое поле</span><small>Оставить ручной ввод, если говорить неудобно.</small></span>
              <input type="checkbox" checked={textInputEnabled} onChange={(event) => setTextInputEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Наблюдения AI</span><small>Короткие выводы без лишнего шума.</small></span>
              <input type="checkbox" checked={aiInsightsEnabled} onChange={(event) => setAIInsightsEnabled(event.target.checked)} />
            </label>
          </div>

          <div className="voice-window-control voice-window-control--number mt-4">
            <div>
              <div className="text-sm font-medium text-white">Сколько слушать после команды</div>
              <div className="mt-1 text-xs text-white/45">Можно поставить любое значение от 3 до 90 секунд. Для быстрого режима удобно 5–10 сек.</div>
            </div>
            <label className="voice-window-control__input">
              <input
                type="number"
                min={3}
                max={90}
                step={1}
                inputMode="numeric"
                value={voiceActiveWindowSeconds}
                onChange={(event) => setVoiceActiveWindowSeconds(Number(event.target.value))}
              />
              <span>сек</span>
            </label>
          </div>
        </section>


        <section className="app-card border-rose-400/20 bg-white/[0.055]">
          <div className="app-section-title">Очистка данных</div>
          <p className="mt-2 text-sm leading-6 text-white/48">
            Для тестов можно начать заново. Финансовая очистка не трогает XP, уровень, серию, рефералы и профиль.
          </p>
          <div className="mt-4 grid gap-3">
            <button
              type="button"
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.055] px-3.5 py-3 text-left text-white/88 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={resetMode !== null}
              onClick={() => handleReset('finance')}
            >
              <span className="block text-[13px] font-bold">Очистить финансы</span>
              <small className="mt-1 block text-[11px] leading-snug text-white/42">Счета, операции, цели, категории, разделы и AI-контекст</small>
            </button>
            <button
              type="button"
              className="w-full rounded-[18px] border border-rose-300/25 bg-rose-500/10 px-3.5 py-3 text-left text-rose-100 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={resetMode !== null}
              onClick={() => handleReset('full')}
            >
              <span className="block text-[13px] font-bold">Сбросить всё</span>
              <small className="mt-1 block text-[11px] leading-snug text-white/42">Финансы, XP, уровень, достижения и companion-прогресс</small>
            </button>
          </div>
          {resetStatus ? <div className="mt-3 text-sm text-white/60">{resetStatus}</div> : null}
        </section>

        <section className="app-card">
          <div className="app-section-title">Разделы приложения</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {navigationItems.map((item) => (
              <button key={item.screen} onClick={() => navigateTo(item.screen)} className="app-nav-card">
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-white/42">{item.caption}</div>
              </button>
            ))}
            {user?.isAdmin ? (
              <button onClick={() => navigateTo('admin')} className="app-nav-card border-emerald-300/20 bg-emerald-300/[0.06]">
                <div className="font-semibold">Админ</div>
                <div className="mt-1 text-sm text-white/42">Статистика и сервер</div>
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
