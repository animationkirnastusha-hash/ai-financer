import { Button, Surface } from '@/shared/ui';

type FinancePreviewCardProps = {
  title: string;
  intent?: string;
  actionId?: string;
  data?: Record<string, unknown>;
  onConfirm?: (id: string) => void | Promise<void>;
  onCancel?: (id: string) => void | Promise<void>;
};

function formatAmount(value: unknown) {
  if (typeof value !== 'number') return '—';
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function getIntentLabel(intent?: string) {
  switch (intent) {
    case 'expense':
      return 'Подтвердить расход';
    case 'income':
      return 'Доход';
    case 'transfer':
      return 'Подтвердить перевод';
    case 'create_account':
      return 'Подтвердить создание счёта';
    default:
      return 'AI действие';
  }
}

function getHumanHint(intent?: string) {
  switch (intent) {
    case 'expense':
      return 'AI понял команду как крупный расход. Проверь сумму и нажми “Подтвердить”, чтобы деньги списались со счёта.';
    case 'transfer':
      return 'AI подготовил перевод. После подтверждения баланс счетов изменится.';
    case 'create_account':
      return 'AI подготовил новый счёт. Подтверди, если всё верно.';
    default:
      return 'Проверь действие перед выполнением.';
  }
}

export function FinancePreviewCard({
  title,
  intent,
  actionId,
  data,
  onConfirm,
  onCancel,
}: FinancePreviewCardProps) {
  const amount = data?.amount;
  const categoryName = data?.categoryName;
  const description = data?.description;
  const riskLevel = data?.riskLevel;
  const requiresConfirmation = Boolean(actionId);

  return (
    <Surface className="mx-auto w-full max-w-[420px] border-amber-300/20 bg-amber-300/10 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200/80">
        {getIntentLabel(intent)}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {formatAmount(amount)}
      </div>

      <div className="mt-2 rounded-2xl border border-amber-300/15 bg-black/20 px-3 py-3 text-sm leading-6 text-amber-50/85">
        {getHumanHint(intent)}
      </div>

      <div className="mt-3 text-sm leading-6 text-white/75">
        {title}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-white/75">
        {typeof categoryName === 'string' ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
            <span className="text-white/45">Категория</span>
            <span className="text-white">{categoryName}</span>
          </div>
        ) : null}

        {typeof description === 'string' && description.trim() ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
            <span className="text-white/45">Описание</span>
            <span className="text-white">{description}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
          <span className="text-white/45">Риск</span>
          <span className="text-amber-100">
            {typeof riskLevel === 'string' ? riskLevel : 'medium'}
          </span>
        </div>
      </div>

      {requiresConfirmation ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button fullWidth onClick={() => onConfirm?.(actionId!)}>
            Подтвердить
          </Button>

          <Button fullWidth variant="secondary" onClick={() => onCancel?.(actionId!)}>
            Отменить
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          Операция выполнена.
        </div>
      )}
    </Surface>
  );
}