import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useAuthStore } from '@/features/auth/model/auth.store';

export default function SettingsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setVoiceRepliesEnabled = useSettingsStore((state) => state.setVoiceRepliesEnabled);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);

  const navigationItems = [
    { title: 'Счета', caption: 'Баланс и основные счета', screen: 'accounts' as const },
    { title: 'Цели', caption: 'Накопления и планы', screen: 'goals' as const },
    { title: 'Companion', caption: 'Голос, реакции и прогресс', screen: 'companion' as const },
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
          <div className="mt-4 space-y-3">
            <label className="app-toggle-row">
              <span><span>Голосовой ввод</span><small>Разрешает управление через companion.</small></span>
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Голос всегда готов</span><small>Пока приложение открыто, companion слушает короткие фразы.</small></span>
              <input type="checkbox" checked={voiceAlwaysOnEnabled} onChange={(event) => setVoiceAlwaysOnEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Бета-режим голоса</span><small>Включает экспериментальную обработку голосовых команд.</small></span>
              <input type="checkbox" checked={voiceBetaEnabled} onChange={(event) => setVoiceBetaEnabled(event.target.checked)} />
            </label>
            <label className="app-toggle-row">
              <span><span>Ответы голосом</span><small>Companion может коротко озвучивать ответ.</small></span>
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
