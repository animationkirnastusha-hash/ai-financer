import { BASE_PLAN, PLAN_LIMITS, PREMIUM_PLAN } from '@/features/premium/model/premium.catalog';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { SettingsSection } from '@/features/settings/ui/SettingsSection';
import { ToggleRow } from '@/features/settings/ui/ToggleRow';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

type Props = {
  onBack: () => void;
};

export default function SettingsPage({ onBack }: Props) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const {
    voiceEnabled,
    voiceBetaEnabled,
    voiceRepliesEnabled,
    aiInsightsEnabled,
    subscriptionPlan,
    secondaryCurrencyEnabled,
    secondaryCurrency,
    rubToUsdRate,
    rubToEurRate,
    setVoiceEnabled,
    setVoiceBetaEnabled,
    setVoiceRepliesEnabled,
    setAIInsightsEnabled,
    setSecondaryCurrencyEnabled,
    setSecondaryCurrency,
    setRubToUsdRate,
    setRubToEurRate,
  } = useSettingsStore();

  const openPremium = usePremiumStore((state) => state.openPremium);
  const isPremium = subscriptionPlan !== 'free';

  function openPremiumFromSettings() {
    openPremium({
      kind: 'premium_voice',
      title: 'Premium усиливает AI, а не забирает базовые функции',
      description:
        'Base остаётся полноценным способом управлять деньгами. Premium добавляет прогнозы, глубокие советы, цели и более живой голосовой режим.',
      cta: 'Посмотреть Premium',
    });
  }

  function handleVoiceRepliesChange(next: boolean) {
    if (!isPremium && next) {
      openPremiumFromSettings();
      return;
    }

    setVoiceRepliesEnabled(next);
  }

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Settings" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="space-y-4">
          <SettingsSection
            title="AI Voice"
            description="Голосовой режим — ключевая часть продукта. В Base оставляем голосовой ввод, а голосовые ответы относим в Premium."
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
              description={
                isPremium
                  ? 'Premium Voice+ может отвечать голосом.'
                  : 'Premium Voice+: более живой голосовой ассистент и голосовые ответы.'
              }
              checked={voiceRepliesEnabled}
              onChange={handleVoiceRepliesChange}
              disabled={!voiceEnabled}
            />
          </SettingsSection>

          <SettingsSection
            title="AI Features"
            description="Управление дополнительными AI-возможностями. Базовые подсказки остаются бесплатными."
          >
            <ToggleRow
              label="AI Insights"
              description="Показывать короткие наблюдения, подсказки и активность AI."
              checked={aiInsightsEnabled}
              onChange={setAIInsightsEnabled}
            />
          </SettingsSection>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Structure
            </div>

            <div className="mt-3 text-xl font-semibold text-white">
              Разделы и категории
            </div>

            <p className="mt-2 text-sm leading-6 text-white/55">
              Это настройка структуры твоих финансов. Здесь создаются разделы,
              категории и правила, а AI должен уметь делать то же самое командой.
            </p>

            <button
              type="button"
              onClick={() => navigateTo('taxonomy-settings')}
              className="mt-4 flex w-full items-center justify-between rounded-[22px] border border-emerald-300/14 bg-emerald-300/10 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium text-emerald-50">
                  Открыть разделы и категории
                </span>
                <span className="mt-1 block text-xs text-emerald-50/55">
                  Свайп вправо вернёт обратно в настройки
                </span>
              </span>
              <span className="text-lg text-emerald-100">›</span>
            </button>
          </section>

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
              Base / Premium
            </div>

            <div className="mt-3 text-xl font-semibold text-white">
              Чёткое разделение планов
            </div>

            <p className="mt-2 text-sm leading-6 text-white/55">
              Base не должен выглядеть как демо. Он закрывает ежедневный контроль
              денег, а Premium продаёт экономию, прогнозы и AI CFO.
            </p>

            <div className="mt-4 grid gap-3">
              {[BASE_PLAN, PREMIUM_PLAN].map((plan) => (
                <div
                  key={plan.plan}
                  className={`rounded-[24px] border p-4 ${
                    plan.plan === 'premium'
                      ? 'border-amber-300/18 bg-amber-300/8'
                      : 'border-emerald-300/14 bg-emerald-300/8'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {plan.name}
                      </div>
                      <div className="mt-1 text-sm text-white/48">{plan.price}</div>
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/70">
                      {plan.badge}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/58">
                    {plan.shortDescription}
                  </p>

                  <div className="mt-4 grid gap-3">
                    {plan.featureGroups.map((group) => (
                      <div key={group.title}>
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                          {group.title}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {group.items.map((item) => (
                            <div key={item} className="text-sm text-white/72">
                              • {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[22px] border border-white/8">
              <div className="grid grid-cols-[1fr_1fr_1fr] bg-white/[0.05] text-[11px] uppercase tracking-[0.12em] text-white/42">
                <div className="p-3">Функция</div>
                <div className="border-l border-white/8 p-3">Base</div>
                <div className="border-l border-white/8 p-3">Premium</div>
              </div>

              {PLAN_LIMITS.map((limit) => (
                <div
                  key={limit.label}
                  className="grid grid-cols-[1fr_1fr_1fr] border-t border-white/8 text-xs leading-5 text-white/58"
                >
                  <div className="p-3 text-white/80">{limit.label}</div>
                  <div className="border-l border-white/8 p-3">{limit.free}</div>
                  <div className="border-l border-white/8 p-3 text-amber-100/78">
                    {limit.premium}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={openPremiumFromSettings}
              className="mt-4 w-full rounded-2xl border border-amber-300/20 bg-amber-300/12 px-4 py-3 text-sm text-white"
            >
              Посмотреть Premium
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
