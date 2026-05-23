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
  return (
    <button type="button" onClick={onClick} className="app-account-card">
      <div className="app-account-card__main">
        <div className="app-account-card__title">
          <div className="app-account-card__name">{name}</div>
          {currency ? <span className="app-account-card__currency">{currency}</span> : null}
        </div>

        {hint ? <div className="app-account-card__hint">{hint}</div> : null}

        <div className="app-account-card__badges">
          {isPrimary ? <Badge tone="green">Главный</Badge> : null}
          {isIncomeDefault ? <Badge tone="blue">Доходы</Badge> : null}
          {lockRename ? <Badge tone="yellow">Имя защищено</Badge> : null}
          {lockSpending ? <Badge tone="red">Траты закрыты</Badge> : null}
          {lockTransfers ? <Badge tone="red">Переводы закрыты</Badge> : null}
        </div>
      </div>

      <div className="app-account-card__balance">{balance}</div>
    </button>
  );
}

function Badge({ children, tone }: { children: string; tone: 'green' | 'blue' | 'yellow' | 'red' }) {
  return <span className={`app-account-badge app-account-badge--${tone}`}>{children}</span>;
}
