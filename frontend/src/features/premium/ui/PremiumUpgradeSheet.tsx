import { useEffect } from 'react';
import { PREMIUM_PLAN, PREMIUM_PRICE_NOTE } from '../model/premium.catalog';
import { usePremiumStore } from '../model/premium.store';
import { useAuthStore } from '@/features/auth/model/auth.store';

export function PremiumUpgradeSheet() {
  const open = usePremiumStore((state) => state.isPremiumOpen);
  const trigger = usePremiumStore((state) => state.activeTrigger);
  const close = usePremiumStore((state) => state.closePremium);
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));

  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open && isAdmin);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open, isAdmin]);

  if (!isAdmin || !open || !trigger) return null;

  const primaryFeatures = PREMIUM_PLAN.featureGroups.flatMap((group) =>
    group.items.slice(0, 2),
  );

  return (
    <div data-no-swipe="true" data-ai-core-modal="true" className="fixed inset-0 z-[120] flex items-end bg-black/65 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0b1016] px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="rounded-[30px] border border-amber-300/15 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_45%),rgba(255,255,255,0.04)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                AI-financer Premium
              </div>

              <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] text-amber-100">
                {PREMIUM_PLAN.badge}
              </div>
            </div>

            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              Твой личный AI CFO
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/62">
              Base остаётся полноценным финансовым ядром. Premium добавляет
              прогнозы, глубокий анализ, цели и более сильного AI-помощника.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/22 p-4">
              <div className="text-sm font-medium text-white">
                {trigger.title}
              </div>

              <div className="mt-2 text-sm leading-6 text-white/55">
                {trigger.description}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {primaryFeatures.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-4"
              >
                <div className="text-sm font-medium text-white">{feature}</div>
                <div className="mt-1 text-xs leading-5 text-white/45">
                  Premium-функция поверх базового контроля денег.
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-emerald-300/15 bg-emerald-300/10 p-4">
            <div className="text-sm font-medium text-emerald-100">
              {PREMIUM_PLAN.price}
            </div>
            <div className="mt-1 text-xs leading-5 text-white/55">
              {PREMIUM_PRICE_NOTE}
            </div>
          </div>

          <div className="sticky bottom-0 mt-5 grid gap-3 bg-[#0b1016]/95 pb-2 pt-3 backdrop-blur-xl">
            <button
              type="button"
              className="rounded-2xl border border-emerald-300/20 bg-emerald-400/16 px-4 py-4 text-sm font-medium text-white"
            >
              Попробовать Premium 7 дней
            </button>

            <button
              type="button"
              onClick={close}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/55"
            >
              Пока продолжить бесплатно
            </button>

            <div className="text-center text-[11px] text-white/35">
              Можно отменить в любой момент
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
