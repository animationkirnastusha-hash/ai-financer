import { useMemo, useState } from 'react';

import { Button, Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { getPendingActionView } from '@/features/pending-actions/lib/pendingActionView';

type EditableRecord = Record<string, any>;

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string, parsedOverride?: Record<string, unknown>) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
};

function isRecord(value: unknown): value is EditableRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clonePayload(item: PendingActionItem): EditableRecord {
  const source = isRecord(item.parsed) ? item.parsed : isRecord(item.payload) ? item.payload : {};
  return JSON.parse(JSON.stringify(source));
}

function inputValue(value: unknown) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function updateAtPath(source: EditableRecord, path: Array<string | number>, value: string) {
  const next = JSON.parse(JSON.stringify(source));
  let cursor: any = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index]];
  }

  const key = path[path.length - 1];
  const numericKeys = new Set(['amount', 'balance', 'initialBalance']);
  cursor[key] = numericKeys.has(String(key)) ? Number(value.replace(/\s/g, '').replace(',', '.')) || 0 : value;

  return next;
}

function EditableField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  inputMode?: 'text' | 'decimal';
}) {
  return (
    <label className="grid gap-1.5 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</span>
      <input
        value={inputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode === 'decimal' ? 'decimal' : 'text'}
        className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/24"
      />
    </label>
  );
}

function EditableAction({
  action,
  index,
  onChange,
}: {
  action: EditableRecord;
  index?: number;
  onChange: (path: Array<string | number>, value: string) => void;
}) {
  const intent = String(action.intent || action.type || '').toLowerCase();
  const isMoney = intent.includes('income') || intent.includes('expense') || intent.includes('transfer');
  const isAccount = intent.includes('account') || action.name !== undefined || action.currency !== undefined;

  return (
    <div className="rounded-[22px] border border-white/8 bg-black/15 p-3">
      {index !== undefined ? (
        <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-white/38">
          Действие {index + 1}
        </div>
      ) : null}

      <div className="grid gap-2">
        {isAccount ? (
          <>
            <EditableField label="Название" value={action.name ?? action.accountName} onChange={(value) => onChange(['name'], value)} />
            <div className="grid grid-cols-2 gap-2">
              <EditableField label="Тип" value={action.type || 'card'} onChange={(value) => onChange(['type'], value)} />
              <EditableField label="Валюта" value={action.currency || 'RUB'} onChange={(value) => onChange(['currency'], value.toUpperCase())} />
            </div>
          </>
        ) : null}

        {isMoney ? (
          <>
            <EditableField label="Сумма" value={action.amount ?? action.balance} inputMode="decimal" onChange={(value) => onChange(['amount'], value)} />
            <EditableField label="Счёт" value={action.accountName || action.toAccountName || action.account} onChange={(value) => onChange(['accountName'], value)} />
            <EditableField label="Описание" value={action.description || action.rawCategory || action.categoryName} onChange={(value) => onChange(['description'], value)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function PendingActionCard({ item, onConfirm, onCancel }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [draft, setDraft] = useState<EditableRecord>(() => clonePayload(item));
  const view = useMemo(() => getPendingActionView({ ...item, parsed: draft }), [draft, item]);
  const isProcessing = processingAction !== null;
  const actions = Array.isArray(draft.actions) ? draft.actions.filter(isRecord) : [];

  const updateDraft = (path: Array<string | number>, value: string) => {
    setDraft((current) => updateAtPath(current, path, value));
  };

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProcessing) return;

    setProcessingAction('confirm');
    try {
      await onConfirm(item.id, draft);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancel = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProcessing) return;

    setProcessingAction('cancel');
    try {
      await onCancel(item.id);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <Surface className="overflow-hidden border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),rgba(255,255,255,0.045)]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-100/85">
                Требуется подтверждение
              </span>
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]',
                  view.riskTone === 'safe' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100/80',
                  view.riskTone === 'medium' && 'border-amber-300/20 bg-amber-300/10 text-amber-100/80',
                  view.riskTone === 'high' && 'border-rose-300/20 bg-rose-300/10 text-rose-100/80',
                )}
              >
                {view.riskLabel}
              </span>
            </div>

            <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
              {view.intentLabel}
            </div>

            <div className="mt-1 text-lg font-semibold leading-snug text-white">
              {view.amountLabel || view.title}
            </div>

            {view.amountLabel && view.title ? (
              <div className="mt-1 text-sm leading-5 text-white/65">{view.title}</div>
            ) : null}
          </div>

          <div className="shrink-0 text-[11px] text-white/35">
            {item.createdAt ? formatTime(item.createdAt) : '—'}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/76">
          <span className="text-amber-100">Проверь и исправь:</span> можно изменить сумму, счёт, название или валюту до подтверждения.
        </div>

        <div className="mt-3 grid gap-2">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <EditableAction
                key={`${index}-${action.intent}`}
                action={action}
                index={index}
                onChange={(path, value) => updateDraft(['actions', index, ...path], value)}
              />
            ))
          ) : (
            <EditableAction action={draft} onChange={(path, value) => updateDraft(path, value)} />
          )}
        </div>

        {view.rawPayload ? (
          <button
            type="button"
            onClick={() => setShowRawPayload((value) => !value)}
            className="mt-3 text-xs text-white/38 transition hover:text-white/65"
          >
            {showRawPayload ? 'Скрыть технические данные' : 'Показать технические данные'}
          </button>
        ) : null}

        {showRawPayload ? (
          <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/8 bg-black/25 p-3 text-xs text-white/55">
            {JSON.stringify(draft, null, 2)}
          </pre>
        ) : null}

        <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <Button disabled={isProcessing} onClick={handleConfirm} fullWidth>
            {processingAction === 'confirm' ? 'Выполняю...' : 'Подтвердить'}
          </Button>

          <Button variant="secondary" disabled={isProcessing} onClick={handleCancel} fullWidth>
            {processingAction === 'cancel' ? 'Отменяю...' : 'Отмена'}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
