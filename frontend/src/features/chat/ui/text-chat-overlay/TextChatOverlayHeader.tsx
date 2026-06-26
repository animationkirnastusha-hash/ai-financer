import type { PointerEvent } from 'react';

type Props = {
  statusState: string;
  statusText: string;
  closeLabel: string;
  receiptLabel: string;
  receiptDisabled?: boolean;
  closeDisabled?: boolean;
  onReceiptClick: () => void;
  onClose: () => void;
  onDragPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragPointerEnd: () => void;
};

export function TextChatOverlayHeader({
  statusState,
  statusText,
  closeLabel,
  receiptLabel,
  receiptDisabled = false,
  closeDisabled = false,
  onReceiptClick,
  onClose,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerEnd,
}: Props) {
  return (
    <>
      <button
        type="button"
        className="text-chat-overlay__handle"
        aria-label={closeLabel}
        disabled={closeDisabled}
        onPointerDown={closeDisabled ? undefined : onDragPointerDown}
        onPointerMove={closeDisabled ? undefined : onDragPointerMove}
        onPointerUp={closeDisabled ? undefined : onDragPointerEnd}
        onPointerCancel={closeDisabled ? undefined : onDragPointerEnd}
      >
        <span />
      </button>
      <header className="text-chat-overlay__head text-chat-overlay__head--compact">
        <div className="text-chat-overlay__status" data-state={statusState}>
          <span className="text-chat-overlay__dot" />
          <span>{statusText}</span>
        </div>
        <div className="text-chat-overlay__head-actions">
          <button
            type="button"
            className="app-icon-button text-chat-overlay__head-receipt"
            onClick={onReceiptClick}
            disabled={receiptDisabled}
            aria-label={receiptLabel}
          >
            <span aria-hidden="true">▧</span>
          </button>
          <button
            type="button"
            className="app-icon-button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
      </header>
    </>
  );
}
