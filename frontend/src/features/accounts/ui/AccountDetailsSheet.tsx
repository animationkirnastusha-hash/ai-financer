import { useEffect } from "react";
import type { AccountDto } from "@/features/accounts/api/accounts.api";
import { formatMoney } from "@/shared/lib/money";
import { useI18n } from "@/shared/lib/i18n";

const ACCOUNT_TYPE_KEYS: Record<string, string> = {
  cash: "accounts.type.cash",
  card: "accounts.type.card",
  savings: "accounts.type.savings",
  credit: "accounts.type.credit",
  investment: "accounts.type.investment",
  default: "accounts.type.default",
};

type Props = {
  account: AccountDto | null;
  open: boolean;
  isPrimary: boolean;
  isIncomeDefault: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onSetPrimary: (accountId: string) => void;
  onSetIncomeDefault: (accountId: string) => void;
  onEdit: (account: AccountDto) => void;
  onTransfer: (account: AccountDto) => void;
  onDelete: (accountId: string) => Promise<void> | void;
  onAskAI: () => void;
};

export function AccountDetailsSheet({
  account,
  open,
  isPrimary,
  isIncomeDefault,
  isDeleting = false,
  onClose,
  onSetPrimary,
  onSetIncomeDefault,
  onEdit,
  onTransfer,
  onDelete,
  onAskAI,
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    document.body.classList.toggle("ai-modal-open", open);
    return () => document.body.classList.remove("ai-modal-open");
  }, [open]);

  if (!open || !account) return null;

  const transactionCount = Number(account.transactionCount ?? 0);
  const typeLabel = t(
    ACCOUNT_TYPE_KEYS[String(account.type ?? "")] ?? ACCOUNT_TYPE_KEYS.default,
  );

  const handleDelete = async () => {
    const confirmed = window.confirm(
      t("accounts.details.deleteConfirm", { name: account.name }),
    );
    if (!confirmed) return;
    await onDelete(account.id);
  };

  return (
    <div
      data-no-swipe="true"
      data-ai-core-modal="true"
      className="app-account-details-sheet"
    >
      <div className="app-account-details-sheet__panel">
        <div className="app-sheet-handle" />

        <div className="app-account-details-sheet__content">
          <header className="app-account-details-sheet__head">
            <div className="min-w-0">
              <div className="app-eyebrow">{t("accounts.details.eyebrow")}</div>
              <h2>{account.name}</h2>
              <p>
                {typeLabel} · {account.currency}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-icon-button"
              aria-label={t("common.close")}
            >
              ×
            </button>
          </header>

          <section className="app-account-details-balance">
            <div>
              <span>{t("accounts.details.balance")}</span>
              <strong>
                {formatMoney(Number(account.balance) || 0, account.currency)}
              </strong>
            </div>
            <div className="app-account-details-balance__chips">
              {isPrimary ? (
                <Badge tone="green">
                  {t("accounts.details.badge.primary")}
                </Badge>
              ) : null}
              {isIncomeDefault ? (
                <Badge tone="blue">{t("accounts.details.badge.income")}</Badge>
              ) : null}
              {account.showInTotalBalance ? (
                <Badge tone="green">
                  {t("accounts.details.badge.inTotal")}
                </Badge>
              ) : (
                <Badge tone="yellow">
                  {t("accounts.details.badge.hiddenFromTotal")}
                </Badge>
              )}
            </div>
          </section>

          <section className="app-account-details-grid">
            <InfoTile label={t("common.type")} value={typeLabel} />
            <InfoTile
              label={t("accounts.details.currency")}
              value={account.currency}
            />
            <InfoTile
              label={t("accounts.details.transactions")}
              value={
                transactionCount > 0
                  ? String(transactionCount)
                  : t("common.none")
              }
            />
          </section>

          {account.lockRename ||
          account.lockSpending ||
          account.lockTransfers ||
          account.lockBalance ||
          account.lockVisibility ? (
            <section className="app-account-details-locks">
              <div className="app-eyebrow">
                {t("accounts.details.protection")}
              </div>
              <div>
                {account.lockRename ? (
                  <Badge tone="yellow">
                    {t("accounts.details.badge.lockRename")}
                  </Badge>
                ) : null}
                {account.lockSpending ? (
                  <Badge tone="red">
                    {t("accounts.details.badge.lockSpending")}
                  </Badge>
                ) : null}
                {account.lockTransfers ? (
                  <Badge tone="red">
                    {t("accounts.details.badge.lockTransfers")}
                  </Badge>
                ) : null}
                {account.lockBalance ? (
                  <Badge tone="yellow">
                    {t("accounts.details.badge.lockBalance")}
                  </Badge>
                ) : null}
                {account.lockVisibility ? (
                  <Badge tone="yellow">
                    {t("accounts.details.badge.lockVisibility")}
                  </Badge>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="app-account-details-actions">
            <button
              type="button"
              onClick={() => onTransfer(account)}
              className="app-account-details-action app-account-details-action--accent"
            >
              <b>{t("accounts.details.transfer")}</b>
              <span>{t("accounts.details.transfer.caption")}</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(account)}
              className="app-account-details-action"
            >
              <b>{t("accounts.details.edit")}</b>
              <span>{t("accounts.details.edit.caption")}</span>
            </button>
            <button
              type="button"
              disabled={isPrimary}
              onClick={() => onSetPrimary(account.id)}
              className="app-account-details-action"
            >
              <b>{t("accounts.details.setPrimary")}</b>
            </button>
            <button
              type="button"
              disabled={isIncomeDefault}
              onClick={() => onSetIncomeDefault(account.id)}
              className="app-account-details-action"
            >
              <b>{t("accounts.details.setIncomeDefault")}</b>
            </button>
            <button
              type="button"
              onClick={onAskAI}
              className="app-account-details-action"
            >
              <b>{t("accounts.details.askAi")}</b>
              <span>{t("accounts.details.askAi.caption")}</span>
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="app-account-details-action app-account-details-action--danger"
            >
              <b>
                {isDeleting
                  ? t("accounts.details.deleting")
                  : t("accounts.details.delete")}
              </b>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-account-details-tile">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "green" | "blue" | "yellow" | "red";
}) {
  return (
    <span
      className={`app-account-details-badge app-account-details-badge--${tone}`}
    >
      {children}
    </span>
  );
}
