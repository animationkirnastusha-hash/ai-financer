import { useState } from 'react';

import { Button, Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { getPendingActionView } from '@/features/pending-actions/lib/pendingActionView';

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
};

export function PendingActionCard({ item, onConfirm, onCancel }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const view = getPendingActionView(item);
  const isProcessing = processingAction !== null;

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProcessing) return;

    setProcessingAction('confirm');
    try {
      await onConfirm(item.id);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancel = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProcessing) return;

    setProcessingAction('cancel');
    try {
      await onCancel(item.id);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <Surface className="overflow-hidden border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),rgba(255,255,255,0.045)]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-100/85">
                AI Preview
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

            <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
              {view.intentLabel}
            </div>

            <div className="mt-1 text-lg font-semibold leading-snug text-white">
              {view.amountLabel || view.title}
            </div>

            {view.amountLabel && view.title ? (
              <div className="mt-1 text-sm leading-5 text-white/65">
                {view.title}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 text-[11px] text-white/35">
            {item.createdAt ? formatTime(item.createdAt) : '—'}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/76">
          <span className="text-amber-100">ИИ понял так:</span> {view.explanation}
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

        {view.rawPayload ? (
          <button
            type="button"
            onClick={() => setShowRawPayload((value) => !value)}
            className="mt-3 text-xs text-white/38 transition hover:text-white/65"
          >
            {showRawPayload ? 'Скрыть технические данные' : 'Показать технические данные'}
          </button>
        ) : null}

        {showRawPayload && view.rawPayload ? (
          <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/8 bg-black/25 p-3 text-xs text-white/55">
            {JSON.stringify(view.rawPayload, null, 2)}
          </pre>
        ) : null}

        <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <Button disabled={isProcessing} onClick={handleConfirm} fullWidth>
            {processingAction === 'confirm' ? 'Выполняю...' : 'Подтвердить'}
          </Button>

          <Button
            variant="secondary"
            disabled={isProcessing}
            onClick={handleCancel}
            fullWidth
          >
            {processingAction === 'cancel' ? 'Отменяю...' : 'Отмена'}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
