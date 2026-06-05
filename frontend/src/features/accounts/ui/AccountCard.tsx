import { useI18n } from '@/shared/lib/i18n';

type Props = {
  name: string;
  balance: string;
  hint?: string;
  currency?: string;
  isPrimary?: boolean;
  isIncomeDefault?: boolean;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  onClick?: () => void;
};

export function AccountCard({
  name,
  balance,
  hint,
  currency,
  isPrimary,
  isIncomeDefault,
  lockRename,
  lockSpending,
  lockTransfers,
  onClick,
}: Props) {
  const { t } = useI18n();

  return (
    <button type="button" onClick={onClick} className="app-account-card">
      <div className="app-account-card__main">
        <div className="app-account-card__identity">
          <div className="app-account-card__title-row">
            <div className="app-account-card__name">{name}</div>
            {currency ? <span className="app-account-card__currency">{currency}</span> : null}
          </div>

          {hint ? <div className="app-account-card__hint">{hint}</div> : null}

          <div className="app-account-card__badges">
            {isPrimary ? <Badge tone="green">{t('accounts.badge.primary')}</Badge> : null}
            {isIncomeDefault ? <Badge tone="blue">{t('accounts.badge.income')}</Badge> : null}
            {lockRename ? <Badge tone="yellow">{t('accounts.badge.lockRename')}</Badge> : null}
            {lockSpending ? <Badge tone="red">{t('accounts.badge.lockSpending')}</Badge> : null}
            {lockTransfers ? <Badge tone="red">{t('accounts.badge.lockTransfers')}</Badge> : null}
          </div>
        </div>

        <div className="app-account-card__balance">{balance}</div>
      </div>
    </button>
  );
}

function Badge({ children, tone }: { children: string; tone: 'green' | 'blue' | 'yellow' | 'red' }) {
  return <span className={`app-account-card__badge app-account-card__badge--${tone}`}>{children}</span>;
}
