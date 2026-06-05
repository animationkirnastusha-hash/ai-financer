import { useI18n } from '@/shared/lib/i18n';

type Props = {
  total: string;
};

export function AccountsSummary({ total }: Props) {
  const { t } = useI18n();

  return (
    <div className="app-accounts-summary-card">
      <div className="app-accounts-summary-card__eyebrow">
        {t('accounts.summary.eyebrow')}
      </div>

      <div className="app-accounts-summary-card__value">
        {total}
      </div>

      <div className="app-accounts-summary-card__caption">
        {t('accounts.summary.caption')}
      </div>
    </div>
  );
}
