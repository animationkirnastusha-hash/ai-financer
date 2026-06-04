import { useEffect } from 'react';

type Props = {
  active: boolean;
};

export function AppModalBodyLock({ active }: Props) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [active]);

  return null;
}
