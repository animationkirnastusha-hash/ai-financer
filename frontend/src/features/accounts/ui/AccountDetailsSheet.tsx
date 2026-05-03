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
  onDelete,
  onAskAI,
}: Props) {
  if (!open || !account) return null;

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Удалить счёт «${account.name}»? Если у счёта есть операции, backend не даст удалить его для безопасности.`,
    );

    if (!confirmed) return;

    await onDelete(account.id);
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Account details
              </div>

              <h2 className="mt-1 text-2xl font-semibold">{account.name}</h2>

              <div className="mt-2 text-sm text-white/45">
                {account.type} · {account.currency}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm"
            >
              Закрыть
            </button>
          </div>

          <div className="mt-5 rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="text-sm text-white/45">Баланс</div>

            <div className="mt-2 text-3xl font-semibold">
              {formatMoney(Number(account.balance) || 0, account.currency)}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {isPrimary ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100">
                  Главный счёт приложения
                </span>
              ) : null}

              {isIncomeDefault ? (
                <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs text-sky-100">
                  Доходы по умолчанию
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              disabled={isPrimary}
              onClick={() => onSetPrimary(account.id)}
              className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-left text-sm text-white transition disabled:opacity-45"
            >
              Сделать главным счётом приложения
              <div className="mt-1 text-xs text-white/45">
                Он будет показываться на AI Core и использоваться как основной.
              </div>
            </button>

            <button
              type="button"
              disabled={isIncomeDefault}
              onClick={() => onSetIncomeDefault(account.id)}
              className="rounded-2xl border border-sky-300/15 bg-sky-300/10 px-4 py-3 text-left text-sm text-white transition disabled:opacity-45"
            >
              Получать доходы сюда
              <div className="mt-1 text-xs text-white/45">
                Для команд типа “+50000 зарплата” этот счёт будет подсказан как целевой.
              </div>
            </button>

            <button
              type="button"
              onClick={onAskAI}
              className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left text-sm text-white transition hover:bg-white/12"
            >
              Открыть AI для этого счёта
              <div className="mt-1 text-xs text-white/45">
                Например: “переведи 5000 с {account.name} на накопительный”.
              </div>
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-left text-sm text-rose-100 transition disabled:opacity-45"
            >
              {isDeleting ? 'Удаляю...' : 'Удалить счёт'}
              <div className="mt-1 text-xs text-white/45">
                Нельзя удалить счёт, если к нему уже привязаны операции.
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}