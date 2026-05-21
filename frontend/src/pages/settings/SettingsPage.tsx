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
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4 text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <ScreenTopBar title="Настройки" left="back" right={['home']} />

        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Управление</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Язык, голос, поведение AI и структура финансов.
          </p>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Язык</div>
              <div className="mt-1 text-sm text-white/42">Сейчас доступны русский и английский.</div>
            </div>
            <LanguageSwitcher />
          </div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Режим AI</div>
          <div className="mt-4 grid gap-3">
            {[
              ['Спокойный AI', 'Короткие ответы и минимум лишних подсказок.'],
              ['Сбалансированный AI', 'Обычный режим для ежедневного учёта.'],
              ['Строгий финансовый режим', 'Больше подтверждений для рискованных действий.'],
            ].map(([title, description]) => (
              <button key={title} className="rounded-[24px] border border-white/8 bg-black/18 p-4 text-left">
                <div className="font-medium">{title}</div>
                <div className="mt-1 text-sm text-white/42">{description}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Голос и подсказки</div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">Голосовой ввод</span><span className="text-sm text-white/42">Зажми помощника и говори.</span></span>
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">Бета-режим голоса</span><span className="text-sm text-white/42">Экспериментальная обработка голосовых команд.</span></span>
              <input type="checkbox" checked={voiceBetaEnabled} onChange={(event) => setVoiceBetaEnabled(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">Наблюдения AI</span><span className="text-sm text-white/42">Короткие выводы без лишних уведомлений.</span></span>
              <input type="checkbox" checked={aiInsightsEnabled} onChange={(event) => setAIInsightsEnabled(event.target.checked)} />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button onClick={() => navigateTo('taxonomy-settings')} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="font-semibold">Разделы</div>
            <div className="mt-1 text-sm text-white/42">Категории и структура</div>
          </button>
          <button onClick={() => navigateTo('premium')} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="font-semibold">Премиум</div>
            <div className="mt-1 text-sm text-white/42">Дополнительные возможности</div>
          </button>
          <button onClick={() => navigateTo('referral')} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="font-semibold">Рефералы</div>
            <div className="mt-1 text-sm text-white/42">Код и приглашения</div>
          </button>
          {user?.isAdmin ? (
            <button onClick={() => navigateTo('admin')} className="rounded-[26px] border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-left">
              <div className="font-semibold">Админ</div>
              <div className="mt-1 text-sm text-white/42">Статистика и сервер</div>
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
