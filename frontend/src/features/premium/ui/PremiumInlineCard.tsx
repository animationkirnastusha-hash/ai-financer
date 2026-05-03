import type { PremiumTrigger } from '../model/premium.types';

type Props = {
  trigger: PremiumTrigger;
  onOpen: (trigger: PremiumTrigger) => void;
};

export function PremiumInlineCard({ trigger, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(trigger)}
      className="w-full rounded-[28px] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_42%),rgba(255,255,255,0.04)] p-4 text-left transition active:scale-[0.99] hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/70">
            Premium insight
          </div>

          <div className="mt-2 text-lg font-semibold leading-tight text-white">
            {trigger.title}
          </div>

          <div className="mt-2 text-sm leading-6 text-white/58">
            {trigger.description}
          </div>

          {trigger.value ? (
            <div className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100">
              {trigger.value}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">
          PRO
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-center text-sm text-white">
        {trigger.cta}
      </div>
    </button>
  );
}