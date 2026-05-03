import { useSettingsStore } from '@/features/settings/model/settings.store';
import { SettingsSection } from '@/features/settings/ui/SettingsSection';
import { ToggleRow } from '@/features/settings/ui/ToggleRow';
import { PageHeader } from '@/shared/ui/PageHeader';
import { usePremiumStore } from '@/features/premium/model/premium.store';
type Props = {
  onBack: () => void;
};

export default function SettingsPage({ onBack }: Props) {
  const {
    voiceEnabled,
    voiceBetaEnabled,
    voiceRepliesEnabled,
    aiInsightsEnabled,
    subscriptionPlan,
    setVoiceEnabled,
    setVoiceBetaEnabled,
    setVoiceRepliesEnabled,
    setAIInsightsEnabled,
  } = useSettingsStore();
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);
const setSecondaryCurrencyEnabled = useSettingsStore((state) => state.setSecondaryCurrencyEnabled);
const setSecondaryCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
const setRubToUsdRate = useSettingsStore((state) => state.setRubToUsdRate);
const setRubToEurRate = useSettingsStore((state) => state.setRubToEurRate);
  const openPremium = usePremiumStore((state) => state.openPremium);
  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Settings" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="space-y-4">
          <SettingsSection
            title="AI Voice"
            description="Голосовой режим — это ключевая часть продукта. Пока он работает в beta-режиме."
          >
            <ToggleRow
              label="Включить голос"
              description="Разрешает использовать голос как способ ввода команд."
              checked={voiceEnabled}
              onChange={setVoiceEnabled}
            />

            <ToggleRow
              label="Voice beta"
              description="Экспериментальный голосовой режим. При сбоях приложение предложит продолжить текстом."
              checked={voiceBetaEnabled}
              onChange={setVoiceBetaEnabled}
              disabled={!voiceEnabled}
            />

            <ToggleRow
              label="Голосовые ответы AI"
              description="Позже AI сможет отвечать голосом. Пока это заготовка под premium."
              checked={voiceRepliesEnabled}
              onChange={setVoiceRepliesEnabled}
              disabled={subscriptionPlan === 'free'}
            />
          </SettingsSection>

          <SettingsSection
            title="AI Features"
            description="Управление дополнительными AI-возможностями."
          >
            <ToggleRow
              label="AI Insights"
              description="Показывать наблюдения, подсказки и активность AI."
              checked={aiInsightsEnabled}
              onChange={setAIInsightsEnabled}
            />
          </SettingsSection>
<section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
  <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
    Currency preview
  </div>

  <div className="mt-3 text-lg font-semibold text-white">
    Вторичная валюта на главном счёте
  </div>

  <p className="mt-2 text-sm leading-6 text-white/55">
    Можно показывать примерную конвертацию ₽ баланса в $ или €. Это
    информационная сумма, не обмен валюты.
  </p>

  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
    <div>
      <div className="text-sm text-white">Показывать конвертацию</div>
      <div className="mt-1 text-xs text-white/40">
        Например: ₽ 100 000 ≈ $1 111
      </div>
    </div>

    <button
      type="button"
      onClick={() => setSecondaryCurrencyEnabled(!secondaryCurrencyEnabled)}
      className={`rounded-full px-3 py-1.5 text-xs ${
        secondaryCurrencyEnabled
          ? 'bg-emerald-400/18 text-emerald-100'
          : 'bg-white/8 text-white/45'
      }`}
    >
      {secondaryCurrencyEnabled ? 'Вкл' : 'Выкл'}
    </button>
  </div>

  <div className="mt-3 flex gap-2">
    {(['USD', 'EUR'] as const).map((currency) => (
      <button
        key={currency}
        type="button"
        onClick={() => setSecondaryCurrency(currency)}
        className={`rounded-2xl border px-4 py-2 text-sm ${
          secondaryCurrency === currency
            ? 'border-emerald-300/25 bg-emerald-300/12 text-white'
            : 'border-white/10 bg-white/5 text-white/50'
        }`}
      >
        {currency}
      </button>
    ))}
  </div>

  <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="block">
      <span className="text-xs text-white/42">1 USD = ₽</span>
      <input
        inputMode="decimal"
        value={rubToUsdRate}
        onChange={(event) => setRubToUsdRate(Number(event.target.value) || 0)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
      />
    </label>

    <label className="block">
      <span className="text-xs text-white/42">1 EUR = ₽</span>
      <input
        inputMode="decimal"
        value={rubToEurRate}
        onChange={(event) => setRubToEurRate(Number(event.target.value) || 0)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
      />
    </label>
  </div>
</section>
          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
  <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
    Subscription
  </div>

  <div className="mt-3 text-xl font-semibold text-white">
    Free — полезный. Premium — сильнее.
  </div>

  <p className="mt-2 text-sm leading-6 text-white/55">
    Базовый AI, голос, счета, операции и история остаются доступными.
    Premium открывает глубокую аналитику, прогнозы и AI CFO.
  </p>

  <button
    type="button"
    onClick={() =>
      openPremium({
        kind: 'premium_voice',
        title: 'Premium усиливает AI, а не забирает базовые функции',
        description:
          'Free остаётся полноценным способом управлять деньгами. Premium добавляет прогнозы, глубокие советы и более живой голосовой режим.',
        cta: 'Посмотреть Premium',
      })
    }
    className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/12 px-4 py-3 text-sm text-white"
  >
    Посмотреть Premium
  </button>
</section>
        </div>
      </div>
    </div>
  );
}