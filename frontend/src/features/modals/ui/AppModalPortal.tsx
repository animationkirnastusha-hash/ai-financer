import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  children: ReactNode;
};

export function AppModalPortal({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}
