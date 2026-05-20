import { useState } from 'react';

import { getPreviewFromMessageData } from '@/features/pending-actions/lib/pendingActionView';
import { cn } from '@/shared/lib/cn';
import { Button, Surface } from '@/shared/ui';

type FinancePreviewCardProps = {
  title: string;
  intent?: string;
  actionId?: string;
  data?: Record<string, unknown>;
  onConfirm?: (id: string) => void | Promise<void>;
  onCancel?: (id: string) => void | Promise<void>;
};

export function FinancePreviewCard({
  title,
  intent,
  actionId,
  data,
  onConfirm,
  onCancel,
}: FinancePreviewCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const view = getPreviewFromMessageData({ title, intent, data });
  const requiresConfirmation = Boolean(actionId);
  const isProcessing = isConfirming || isCancelling;

  const handleConfirm = async () => {
    if (!actionId || isProcessing) return;

    setIsConfirming(true);
    try {
      await onConfirm?.(actionId);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!actionId || isProcessing) return;

    setIsCancelling(true);
    try {
      await onCancel?.(actionId);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Surface className="mx-auto w-full max-w-[430px] overflow-hidden border-emerald-300/16 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_35%),rgba(255,255,255,0.045)]">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/85">
            Проверь
          </span>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]',
              view.riskTone === 'safe' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100/80',
              view.riskTone === 'medium' && 'border-amber-300/20 bg-amber-300/10 text-amber-100/80',
              view.riskTone === 'high' && 'border-rose-300/20 bg-rose-300/10 text-rose-100/80',
            )}
          >
            {view.riskLabel}
          </span>
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/35">
          {view.intentLabel}
        </div>

        <div className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white">
          {view.amountLabel || view.title}
        </div>

        {view.amountLabel ? (
          <div className="mt-1 text-sm leading-5 text-white/65">{view.title}</div>
        ) : null}

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/72">
          {view.explanation}
        </div>

        {view.rows.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {view.rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm"
              >
                <span className="text-white/45">{row.label}</span>
                <span className="max-w-[62%] truncate text-right font-medium text-white/88">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {requiresConfirmation ? (
          <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
            <Button fullWidth disabled={isProcessing} onClick={handleConfirm}>
              {isConfirming ? 'Выполняю...' : 'Подтвердить'}
            </Button>

            <Button fullWidth variant="secondary" disabled={isProcessing} onClick={handleCancel}>
              {isCancelling ? 'Отменяю...' : 'Отмена'}
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
            Операция выполнена.
          </div>
        )}
      </div>
    </Surface>
  );
}
