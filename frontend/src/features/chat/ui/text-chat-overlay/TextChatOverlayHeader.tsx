import type { PointerEvent } from 'react';

type Props = {
  statusState: string;
  statusText: string;
  closeLabel: string;
  onClose: () => void;
  onDragPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragPointerEnd: () => void;
};

export function TextChatOverlayHeader({
  statusState,
  statusText,
  closeLabel,
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
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerEnd}
        onPointerCancel={onDragPointerEnd}
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
            className="app-icon-button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
      </header>
    </>
  );
}
