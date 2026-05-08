import { useEffect } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import { formatMoney } from '@/shared/lib/money';

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
  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  if (!open || !account) return null;

  const transactionCount = Number(account.transactionCount ?? 0);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Удалить счёт «${account.name}»? Если у счёта есть операции, backend не даст удалить его для безопасности.`,
    );
    if (!confirmed) return;
    await onDelete(account.id);
  };

  return (
    <div data-no-swipe="true" data-ai-core-modal="true" className="fixed inset-0 z-[120] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Account details</div>
              <h2 className="mt-1 text-2xl font-semibold">{account.name}</h2>
              <div className="mt-2 text-sm text-white/45">{account.type} · {account.currency}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm">
              Закрыть
            </button>
          </div>

          <div className="rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_42%),rgba(255,255,255,0.04)] p-5">
            <div className="text-sm text-white/45">Баланс</div>
            <div className="mt-2 text-3xl font-semibold">{formatMoney(Number(account.balance) || 0, account.currency)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {isPrimary ? <Badge tone="green">Главный счёт</Badge> : null}
              {isIncomeDefault ? <Badge tone="blue">Доходы сюда</Badge> : null}
              {account.showInTotalBalance ? <Badge tone="green">В общем балансе</Badge> : <Badge tone="yellow">Скрыт из общего</Badge>}
              {account.lockRename ? <Badge tone="yellow">Название защищено</Badge> : null}
              {account.lockSpending ? <Badge tone="red">Траты запрещены</Badge> : null}
              {account.lockTransfers ? <Badge tone="red">Переводы запрещены</Badge> : null}
              {account.lockBalance ? <Badge tone="yellow">Баланс защищён</Badge> : null}
              {account.lockVisibility ? <Badge tone="yellow">Видимость защищена</Badge> : null}
            </div>
          </div>

          <section className="grid grid-cols-2 gap-3">
            <InfoTile label="Операции" value={transactionCount > 0 ? String(transactionCount) : 'Нет'} />
            <InfoTile label="Валюта" value={account.currency} />
          </section>

          <div className="grid gap-3">
            <button type="button" onClick={() => onTransfer(account)} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-4 py-3 text-left text-sm text-white transition active:scale-[0.99]">
              ↔️ Перевести на другой счёт
              <div className="mt-1 text-xs text-white/45">Ручной перевод сейчас, AI-перевод через подтверждение — тем же принципом.</div>
            </button>

            <button type="button" onClick={() => onEdit(account)} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm text-white transition active:scale-[0.99]">
              ✏️ Редактировать счёт
              <div className="mt-1 text-xs text-white/45">Название, баланс, валюта и защитные правила.</div>
            </button>

            <button type="button" disabled={isPrimary} onClick={() => onSetPrimary(account.id)} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm transition disabled:opacity-45">
              Сделать главным счётом
            </button>

            <button type="button" disabled={isIncomeDefault} onClick={() => onSetIncomeDefault(account.id)} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm transition disabled:opacity-45">
              Сделать счётом для доходов
            </button>

            <button type="button" onClick={onAskAI} className="rounded-2xl border border-sky-300/15 bg-sky-300/10 px-4 py-3 text-left text-sm text-white">
              Открыть AI для работы со счётом
              <div className="mt-1 text-xs text-white/45">Например: “запрети переводы с этого счёта”.</div>
            </button>

            <button type="button" disabled={isDeleting} onClick={handleDelete} className="rounded-2xl border border-red-300/15 bg-red-300/10 px-4 py-3 text-left text-sm text-red-100 disabled:opacity-50">
              {isDeleting ? 'Удаляю...' : 'Удалить счёт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <div className="text-xs text-white/42">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: 'green' | 'blue' | 'yellow' | 'red' }) {
  const className =
    tone === 'green'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
      : tone === 'blue'
        ? 'border-sky-300/20 bg-sky-300/10 text-sky-100'
        : tone === 'yellow'
          ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'
          : 'border-red-300/20 bg-red-300/10 text-red-100';

  return <span className={`rounded-full border px-3 py-1.5 text-xs ${className}`}>{children}</span>;
}
