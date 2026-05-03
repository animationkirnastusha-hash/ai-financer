import type { ReactNode } from 'react';
import { Button } from '@/shared/ui';
import type { SubscriptionPlan } from '@/features/settings/model/settings.types';

type Props = {
  plan: SubscriptionPlan;
  activePlan: SubscriptionPlan;
  title: string;
  price: string;
  features: string[];
  badge?: string;
  icon?: ReactNode;
  onSelect: (plan: SubscriptionPlan) => void;
};

export function PlanCard({
  plan,
  activePlan,
  title,
  price,
  features,
  badge,
  onSelect,
}: Props) {
  const isActive = activePlan === plan;

  return (
    <div
      className={`rounded-[28px] border p-4 ${
        isActive
          ? 'border-emerald-400/25 bg-emerald-400/10'
          : 'border-white/8 bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/60">{price}</div>
        </div>

        {badge ? (
          <div className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/70">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {features.map((feature) => (
          <div key={feature} className="text-sm text-white/75">
            • {feature}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button
          variant={isActive ? 'secondary' : 'primary'}
          fullWidth
          onClick={() => onSelect(plan)}
        >
          {isActive ? 'Текущий план' : 'Выбрать'}
        </Button>
      </div>
    </div>
  );
}