import { useEffect, useState } from 'react';
import { premiumApi, type PremiumCapabilitiesDto } from '@/shared/api/premium.api';

const capabilities = [
  ['advanced_memory', 'Advanced memory', 'Больше контекста и continuity.'],
  ['proactive_insights', 'Proactive insights', 'Спокойные подсказки без спама.'],
  ['advanced_automation', 'Advanced automation', 'Глубокие сценарии позже.'],
  ['premium_companion', 'Premium companion', 'Больше awareness, не ролеплей.'],
  ['deep_analytics', 'Deep analytics', 'Trends, forecasting, reports.'],
];

export default function PremiumPage() {
  const [state, setState] = useState<PremiumCapabilitiesDto | null>(null);

  useEffect(() => {
    let mounted = true;
    premiumApi.getCapabilities().then((next) => mounted && setState(next));
    return () => {
      mounted = false;
    };
  }, []);

  const tier = state?.tier || 'FREE';

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Premium</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Глубина, не блокировка базы</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Free должен ощущаться полноценным. Premium добавляет forecasting, memory, deep analytics и companion depth.</p>
          <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">Current tier: {tier}</div>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Capability boundaries</div>
          <div className="mt-4 space-y-3">
            {capabilities.map(([key, title, description]) => {
              const enabled = Boolean(state?.capabilities?.[key]);
              return (
                <div key={key} className="flex items-start justify-between gap-3 rounded-[24px] border border-white/8 bg-black/18 p-4">
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="mt-1 text-sm text-white/45">{description}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs ${enabled ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/8 text-white/38'}`}>{enabled ? 'ON' : 'LOCKED'}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-amber-200/12 bg-amber-200/[0.06] p-5">
          <div className="text-lg font-semibold">Важно</div>
          <p className="mt-2 text-sm leading-6 text-white/52">Это UX preview. Настоящая продажа Premium требует billing/subscription pack: платежи, webhook, expiration, admin override.</p>
        </section>
      </div>
    </div>
  );
}
