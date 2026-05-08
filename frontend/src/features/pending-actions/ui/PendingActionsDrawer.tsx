import { useEffect } from 'react';
import { Drawer } from '@/shared/ui';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { PendingActionCard } from '@/features/pending-actions/ui/PendingActionCard';

type Props = {
  open: boolean;
  items: PendingActionItem[];
  onClose: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
};

export function PendingActionsDrawer({
  open,
  items,
  onClose,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  return (
    <Drawer open={open} onClose={onClose} title="AI ждёт подтверждения">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pb-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-white/55">
            Сейчас нет ожидающих AI-действий.
          </div>
        ) : (
          items.map((item) => (
            <PendingActionCard
              key={item.id}
              item={item}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </Drawer>
  );
}
