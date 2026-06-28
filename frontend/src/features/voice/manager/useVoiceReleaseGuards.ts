import { useEffect, useRef } from 'react';

export type VoiceReleaseGuardsParams = {
  active: boolean;
  onRelease: () => void;
  onCancel: () => void;
};

export function useVoiceReleaseGuards({ active, onRelease, onCancel }: VoiceReleaseGuardsParams) {
  const onReleaseRef = useRef(onRelease);
  const onCancelRef = useRef(onCancel);

  onReleaseRef.current = onRelease;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!active) return;

    const release = () => onReleaseRef.current();
    const cancel = () => onCancelRef.current();
    const cancelOnHidden = () => {
      if (document.visibilityState === 'hidden') cancel();
    };

    window.addEventListener('pointerup', release, true);
    window.addEventListener('mouseup', release, true);
    window.addEventListener('touchend', release, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('touchcancel', cancel, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', cancelOnHidden);

    return () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('mouseup', release, true);
      window.removeEventListener('touchend', release, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('touchcancel', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', cancel);
      document.removeEventListener('visibilitychange', cancelOnHidden);
    };
  }, [active]);
}
