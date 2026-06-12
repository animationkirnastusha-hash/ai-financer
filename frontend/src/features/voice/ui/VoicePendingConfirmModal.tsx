import { PendingActionCard } from '@/features/pending-actions/ui/PendingActionCard';
import { useI18n } from '@/shared/lib/i18n';

type VoicePendingConfirmModalProps = {
  pendingActions: any[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: (id: string, parsed: Record<string, unknown>, command?: string) => Promise<void> | void;
};

function getParsed(item: any): Record<string, unknown> | null {
  const parsed = item?.parsed;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function getClarification(item: any): Record<string, unknown> | null {
  const clarification = getParsed(item)?.clarification;
  return clarification && typeof clarification === 'object' && !Array.isArray(clarification)
    ? clarification as Record<string, unknown>
    : null;
}

function getClarificationQuestion(item: any, fallback: string) {
  const question = getClarification(item)?.question;
  return typeof question === 'string' && question.trim() ? question.trim() : fallback;
}

export function VoicePendingConfirmModal({ pendingActions, onConfirm, onCancel, onUpdate }: VoicePendingConfirmModalProps) {
  const { t } = useI18n();

  if (pendingActions.length === 0) return null;

  const item = pendingActions[0];
  const clarification = getClarification(item);

  return (
    <div className="app-modal-backdrop app-pending-confirm-backdrop" data-no-swipe="true">
      <div className="app-modal-sheet app-pending-confirm-sheet" data-no-swipe="true">
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-pending-confirm-head">
            <div>
              <div className="app-eyebrow">
                {clarification ? t('voicePending.eyebrow.clarification') : t('voicePending.eyebrow.review')}
              </div>
              <h2>{clarification ? t('voicePending.title.clarification') : t('voicePending.title.review')}</h2>
              <p>
                {clarification
                  ? t('voicePending.caption.clarification')
                  : t('voicePending.caption.review')}
              </p>
            </div>
          </div>

          {clarification ? (
            <div className="voice-clarification-card">
              <div className="voice-clarification-card__question">
                {getClarificationQuestion(item, t('voicePending.clarification.fallback'))}
              </div>
              <div className="voice-clarification-card__hint">{t('voicePending.clarification.hint')}</div>
              <button className="app-secondary-button" type="button" onClick={() => onCancel(item.id)}>
                {t('voicePending.action.cancel')}
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <PendingActionCard
                key={item.id}
                item={item}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onUpdate={onUpdate}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
