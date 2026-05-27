import { PendingActionCard } from '@/features/pending-actions/ui/PendingActionCard';

type VoicePendingConfirmModalProps = {
  pendingActions: any[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: (id: string, parsed: Record<string, unknown>, command?: string) => Promise<void> | void;
};

export function VoicePendingConfirmModal({ pendingActions, onConfirm, onCancel, onUpdate }: VoicePendingConfirmModalProps) {
  if (pendingActions.length === 0) return null;

  return (
    <div className="app-modal-backdrop app-pending-confirm-backdrop" data-no-swipe="true">
      <div className="app-modal-sheet app-pending-confirm-sheet" data-no-swipe="true">
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-pending-confirm-head">
            <div>
              <div className="app-eyebrow">Проверка</div>
              <h2>Подтверди действие</h2>
              <p>Фина выполнит его после подтверждения.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {pendingActions.slice(0, 1).map((item) => (
              <PendingActionCard
                key={item.id}
                item={item}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
