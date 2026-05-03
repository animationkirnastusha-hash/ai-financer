import { useState } from 'react';

import { Button, Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
};

export function PendingActionCard({ item, onConfirm, onCancel }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | null>(null);

  const isProcessing = processingAction !== null;

  const title =
    item.summary ||
    item.type ||
    item.intent ||
    item.command ||
    'Ожидает подтверждения';

  const payload = item.payload || item.parsed;

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
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-amber-300/70">
            Требуется подтверждение
          </div>

          <div className="mt-1 truncate text-sm font-medium text-white">
            {title}
          </div>

          {item.riskLevel ? (
            <div className="mt-1 text-xs text-white/45">
              Риск: {item.riskLevel}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-[11px] text-white/35">
          {item.createdAt ? formatTime(item.createdAt) : '—'}
        </div>
      </div>

      {payload ? (
        <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/8 bg-black/20 p-3 text-xs text-white/65">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
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
    </Surface>
  );
}