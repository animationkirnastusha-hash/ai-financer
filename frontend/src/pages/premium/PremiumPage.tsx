import { useEffect, useState } from 'react';
import { premiumApi, type PremiumCapabilitiesDto } from '@/shared/api/premium.api';
import { PageHeader } from '@/shared/ui/PageHeader';

const capabilities = [
  ['advanced_memory', 'Расширенная память', 'AI лучше помнит контекст и прошлые решения.'],
  ['proactive_insights', 'Проактивные выводы', 'Спокойные подсказки без лишних уведомлений.'],
  ['advanced_automation', 'Сложные сценарии', 'Больше автоматизации для регулярных действий.'],
  ['premium_companion', 'Расширенный компаньон', 'Больше реакций, состояний и персонального контекста.'],
  ['deep_analytics', 'Глубокая аналитика', 'Прогнозы, тренды и ежемесячные отчёты.'],
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
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Премиум" subtitle="Дополнительные возможности" />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="mx-auto max-w-[620px] space-y-4">
          <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Премиум</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Больше глубины</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Базовый продукт остаётся полноценным. Премиум добавляет прогнозы, память и расширенную аналитику.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
              Текущий тариф: {tier}
            </div>
          </header>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-lg font-semibold">Возможности</div>
            <div className="mt-4 space-y-3">
              {capabilities.map(([key, title, description]) => {
                const enabled = Boolean(state?.capabilities?.[key]);
                return (
                  <div key={key} className="flex items-start justify-between gap-3 rounded-[24px] border border-white/8 bg-black/18 p-4">
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="mt-1 text-sm text-white/45">{description}</div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs ${enabled ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/8 text-white/38'}`}>
                      {enabled ? 'Доступно' : 'Позже'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
