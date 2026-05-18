import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export default function SettingsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Settings</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Настройки без enterprise-панели</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Основная логика: Recommended mode для большинства, Advanced mode для power users.</p>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Recommended mode</div>
          <div className="mt-4 grid gap-3">
            {['Calm AI', 'Balanced AI', 'Strict Finance'].map((preset) => (
              <button key={preset} className="rounded-[24px] border border-white/8 bg-black/18 p-4 text-left">
                <div className="font-medium">{preset}</div>
                <div className="mt-1 text-sm text-white/42">Preset для поведения AI и companion.</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Advanced mode</div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">Voice input</span><span className="text-sm text-white/42">Hold companion → speak naturally.</span></span>
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">Voice beta</span><span className="text-sm text-white/42">Экспериментальный голосовой режим.</span></span>
              <input type="checkbox" checked={voiceBetaEnabled} onChange={(e) => setVoiceBetaEnabled(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-black/18 p-4">
              <span><span className="block font-medium">AI insights</span><span className="text-sm text-white/42">Короткие наблюдения без спама.</span></span>
              <input type="checkbox" checked={aiInsightsEnabled} onChange={(e) => setAIInsightsEnabled(e.target.checked)} />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button onClick={() => navigateTo('taxonomy-settings')} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="font-semibold">Разделы</div>
            <div className="mt-1 text-sm text-white/42">Категории и структура</div>
          </button>
          <button onClick={() => navigateTo('premium')} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="font-semibold">Premium</div>
            <div className="mt-1 text-sm text-white/42">Capabilities preview</div>
          </button>
        </section>
      </div>
    </div>
  );
}
