import { useState, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api';

type SettingsModal = 'voice' | 'assistant' | 'ai' | 'data' | null;

function SettingsModalShell({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="app-modal-backdrop" data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body space-y-4">
          <div>
            <div className="app-eyebrow">Настройки</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{title}</h2>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-white/50">{subtitle}</p> : null}
          </div>
          {children}
        </div>
        <footer className="app-modal-footer">
          <button type="button" onClick={onClose} className="app-primary-button w-full">Готово</button>
        </footer>
      </div>
    </div>
  );
}

function SettingButton({ title, caption, icon, onClick }: { title: string; caption: string; icon: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-settings-card-button">
      <span>
        <b>{title}</b>
        <small>{caption}</small>
      </span>
      <i aria-hidden="true">{icon}</i>
    </button>
  );
}

export default function SettingsPage() {
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<DataResetMode | null>(null);
  const [modal, setModal] = useState<SettingsModal>(null);

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
    { title: 'Фина', caption: 'Прогресс и привычки', screen: 'companion' as const },
    { title: 'Категории', caption: 'Разделы и структура', screen: 'sections' as const },
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
          <p className="mt-3 text-sm leading-6 text-white/50">Язык, голос, данные и основные разделы приложения.</p>
        </header>

        <section className="app-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="app-section-title">Язык</div>
              <div className="mt-1 text-sm text-white/42">Интерфейс приложения</div>
            </div>
            <LanguageSwitcher />
          </div>
        </section>

        <section className="app-card">
          <div className="app-section-title">Основные настройки</div>
          <div className="app-settings-grid mt-4">
            <SettingButton title="Голос" caption={voiceAlwaysOnEnabled ? 'Микрофон включён' : 'Микрофон выключен'} icon="◉" onClick={() => setModal('voice')} />
            <SettingButton title="Фина" caption="Ответы, окно прослушивания и текстовый ввод" icon="◌" onClick={() => setModal('assistant')} />
            <SettingButton title="AI" caption={aiInsightsEnabled ? 'Короткие выводы включены' : 'Выводы выключены'} icon="✦" onClick={() => setModal('ai')} />
            <SettingButton title="Данные" caption="Очистка финансов или полный сброс" icon="⌫" onClick={() => setModal('data')} />
          </div>
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

      {modal === 'voice' ? (
        <SettingsModalShell title="Голос" subtitle="Настройки микрофона и запуска голосового управления." onClose={() => setModal(null)}>
          <div className="app-settings-modal-grid">
            <label className="app-toggle-row">
              <span><span>Голосовой ввод</span><small>Разрешить управление голосом.</small></span>
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Микрофон включён</span><small>Фина будет ждать обращение, пока приложение открыто.</small></span>
              <input type="checkbox" checked={voiceAlwaysOnEnabled} onChange={(event) => setVoiceAlwaysOnEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Запуск по имени</span><small>Команды выполняются только после обращения к Фине.</small></span>
              <input type="checkbox" checked={voiceWakeWordEnabled} onChange={(event) => setVoiceWakeWordEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Бета-режим</span><small>Улучшенный цикл голосового ввода.</small></span>
              <input type="checkbox" checked={voiceBetaEnabled} onChange={(event) => setVoiceBetaEnabled(event.target.checked)} />
            </label>
          </div>
        </SettingsModalShell>
      ) : null}

      {modal === 'assistant' ? (
        <SettingsModalShell title="Фина" subtitle="Как Фина отвечает и сколько времени слушает продолжение." onClose={() => setModal(null)}>
          <div className="app-settings-modal-grid">
            <label className="app-toggle-row">
              <span><span>Ответы голосом</span><small>Коротко озвучивать результат.</small></span>
              <input type="checkbox" checked={voiceRepliesEnabled} onChange={(event) => setVoiceRepliesEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Текстовый ввод</span><small>Оставить запасной способ ввода.</small></span>
              <input type="checkbox" checked={textInputEnabled} onChange={(event) => setTextInputEnabled(event.target.checked)} />
            </label>
            <div className="voice-window-control voice-window-control--number">
              <div>
                <div className="text-sm font-medium text-white">Слушать продолжение</div>
                <div className="mt-1 text-xs text-white/45">После ответа Фина ждёт следующую фразу заданное число секунд.</div>
              </div>
              <label className="voice-window-control__input">
                <input type="number" min={2} max={120} step={1} inputMode="numeric" value={voiceActiveWindowSeconds} onChange={(event) => setVoiceActiveWindowSeconds(Number(event.target.value))} />
                <span>сек</span>
              </label>
            </div>
          </div>
        </SettingsModalShell>
      ) : null}

      {modal === 'ai' ? (
        <SettingsModalShell title="AI" subtitle="Короткие подсказки и выводы по финансовому состоянию." onClose={() => setModal(null)}>
          <label className="app-toggle-row">
            <span><span>Наблюдения</span><small>Показывать короткие финансовые выводы.</small></span>
            <input type="checkbox" checked={aiInsightsEnabled} onChange={(event) => setAIInsightsEnabled(event.target.checked)} />
          </label>
        </SettingsModalShell>
      ) : null}

      {modal === 'data' ? (
        <SettingsModalShell title="Данные" subtitle="Для тестов можно быстро начать заново." onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <button type="button" className="w-full rounded-[18px] border border-white/10 bg-white/[0.055] px-3.5 py-3 text-left text-white/88 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55" disabled={resetMode !== null} onClick={() => handleReset('finance')}>
              <span className="block text-[13px] font-bold">Очистить финансы</span>
              <small className="mt-1 block text-[11px] leading-snug text-white/42">Счета, операции, цели, категории и историю AI</small>
            </button>
            <button type="button" className="w-full rounded-[18px] border border-rose-300/25 bg-rose-500/10 px-3.5 py-3 text-left text-rose-100 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55" disabled={resetMode !== null} onClick={() => handleReset('full')}>
              <span className="block text-[13px] font-bold">Сбросить всё</span>
              <small className="mt-1 block text-[11px] leading-snug text-white/42">Финансы, XP, уровень, достижения и прогресс</small>
            </button>
            {resetStatus ? <div className="text-sm text-white/60">{resetStatus}</div> : null}
          </div>
        </SettingsModalShell>
      ) : null}
    </div>
  );
}
