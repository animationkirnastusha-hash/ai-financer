type Props = {
  onCancel: () => void;
};

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.3 5.9 12 10.6l4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.7 1.4-1.4Z" />
    </svg>
  );
}

export function VoiceLockActions({ onCancel }: Props) {
  return (
    <div className="voice-first-lock-actions voice-first-lock-actions--cancel-only voice-first-lock-actions--detached" aria-label="Управление записью" data-no-swipe="true">
      <button type="button" className="voice-first-lock-action voice-first-lock-action--cancel" onClick={onCancel} aria-label="Отменить запись">
        <CancelIcon />
      </button>
    </div>
  );
}
