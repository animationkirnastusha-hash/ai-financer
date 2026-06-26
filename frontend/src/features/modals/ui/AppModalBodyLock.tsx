import { useEffect } from 'react';

type Props = {
  active: boolean;
};

let lockedScrollY = 0;

export function AppModalBodyLock({ active }: Props) {
  useEffect(() => {
    if (!active) return;

    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const previousBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
    };
    const previousHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      touchAction: document.documentElement.style.touchAction,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };

    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.touchAction = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.left = previousBodyStyle.left;
      document.body.style.right = previousBodyStyle.right;
      document.body.style.width = previousBodyStyle.width;
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.touchAction = previousBodyStyle.touchAction;
      document.documentElement.style.overflow = previousHtmlStyle.overflow;
      document.documentElement.style.touchAction = previousHtmlStyle.touchAction;
      document.documentElement.style.overscrollBehavior = previousHtmlStyle.overscrollBehavior;
      window.scrollTo(0, lockedScrollY);
    };
  }, [active]);

  return null;
}
