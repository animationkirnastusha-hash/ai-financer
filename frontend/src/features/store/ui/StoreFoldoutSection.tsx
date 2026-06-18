import type { ReactNode } from 'react';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type Props = {
  eyebrowKey: I18nKey;
  titleKey: I18nKey;
  captionKey: I18nKey;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function StoreFoldoutSection({ eyebrowKey, titleKey, captionKey, defaultOpen = false, children }: Props) {
  const { t } = useI18n();

  return (
    <details className="store-foldout-section app-card" open={defaultOpen}>
      <summary className="store-foldout-section__summary">
        <span className="store-foldout-section__copy">
          <span className="app-eyebrow">{t(eyebrowKey)}</span>
          <strong>{t(titleKey)}</strong>
          <small>{t(captionKey)}</small>
        </span>
        <span className="store-foldout-section__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="store-foldout-section__body">
        {children}
      </div>
    </details>
  );
}
