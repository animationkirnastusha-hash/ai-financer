import { useMemo, useState } from 'react';
import type React from 'react';

import { Button, Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { getPendingActionView } from '@/features/pending-actions/lib/pendingActionView';

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
  onUpdate?: (id: string, parsed: Record<string, unknown>, command?: string) => Promise<void> | void;
};

type EditableAction = Record<string, unknown>;

const ACCOUNT_TYPES = ['card', 'cash', 'savings', 'investment'];
const CURRENCIES = ['RUB', 'USD', 'EUR'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneParsed(parsed: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!parsed) return {};
  return JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
}

function getEditableActions(parsed: Record<string, unknown>) {
  if (Array.isArray(parsed.actions)) return parsed.actions.filter(isRecord) as EditableAction[];
  return [parsed];
}

function actionLabel(action: EditableAction, index: number) {
  const intent = String(action.intent ?? '').toLowerCase();
  if (intent === 'create_account') return `${index + 1}. Счёт`;
  if (intent === 'income') return `${index + 1}. Доход`;
  if (intent === 'expense') return `${index + 1}. Расход`;
  if (intent === 'transfer') return `${index + 1}. Перевод`;
  if (intent === 'create_category') return `${index + 1}. Категория`;
  if (intent === 'create_section') return `${index + 1}. Раздел`;
  return `${index + 1}. Действие`;
}

function EditableField({ label, value, onChange, inputMode = 'text' }: { label: string; value: string; onChange: (value: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return (
    <label className="block rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-white/38">{label}</div>
      <input
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-white/38">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-white outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function PendingActionCard({ item, onConfirm, onCancel, onUpdate }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | 'save' | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => cloneParsed(item.parsed));
  const view = getPendingActionView({ ...item, parsed: draft });
  const isProcessing = processingAction !== null;

  const actions = useMemo(() => getEditableActions(draft), [draft]);

  const setActionValue = (index: number, key: string, value: unknown) => {
    setDraft((current) => {
      const next = cloneParsed(current);
      if (Array.isArray(next.actions)) {
        const arr = [...next.actions];
        const action = isRecord(arr[index]) ? { ...arr[index] } : {};
        action[key] = value;
        arr[index] = action;
        next.actions = arr;
        return next;
      }

      next[key] = value;
      return next;
    });
  };

  const handleSaveDraft = async () => {
    if (!onUpdate || isProcessing) return;
    setProcessingAction('save');
    try {
      await onUpdate(item.id, draft, item.command);
      setIsEditing(false);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProcessing) return;

    setProcessingAction('confirm');
    try {
      if (onUpdate && isEditing) {
        await onUpdate(item.id, draft, item.command);
      }
      await onConfirm(item.id);
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
                AI Preview
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
              <div className="mt-1 text-sm leading-5 text-white/65">
                {view.title}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 text-[11px] text-white/35">
            {item.createdAt ? formatTime(item.createdAt) : '—'}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/76">
          <span className="text-amber-100">Проверь:</span> {view.explanation}
        </div>

        {isEditing ? (
          <div className="mt-3 grid gap-3 rounded-[22px] border border-emerald-300/12 bg-emerald-300/[0.04] p-3">
            {actions.map((action, index) => {
              const intent = String(action.intent ?? '');
              return (
                <div key={index} className="grid gap-2 rounded-2xl border border-white/8 bg-black/15 p-3">
                  <div className="text-xs font-medium text-white/70">{actionLabel(action, index)}</div>

                  {intent === 'create_account' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <EditableField label="Название" value={String(action.name ?? '')} onChange={(value) => setActionValue(index, 'name', value)} />
                      <SelectField label="Валюта" value={String(action.currency ?? 'RUB')} options={CURRENCIES} onChange={(value) => setActionValue(index, 'currency', value)} />
                      <SelectField label="Тип" value={String(action.type ?? 'card')} options={ACCOUNT_TYPES} onChange={(value) => setActionValue(index, 'type', value)} />
                    </div>
                  ) : null}

                  {intent === 'income' || intent === 'expense' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <EditableField label="Сумма" inputMode="decimal" value={String(action.amount ?? '')} onChange={(value) => setActionValue(index, 'amount', Number(value.replace(',', '.')) || value)} />
                      <EditableField label="Счёт" value={String(action.accountName ?? '')} onChange={(value) => setActionValue(index, 'accountName', value)} />
                      <EditableField label="Категория" value={String(action.rawCategory ?? '')} onChange={(value) => setActionValue(index, 'rawCategory', value)} />
                      <EditableField label="Описание" value={String(action.description ?? '')} onChange={(value) => setActionValue(index, 'description', value)} />
                    </div>
                  ) : null}

                  {intent === 'transfer' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <EditableField label="Сумма" inputMode="decimal" value={String(action.amount ?? '')} onChange={(value) => setActionValue(index, 'amount', Number(value.replace(',', '.')) || value)} />
                      <EditableField label="Откуда" value={String(action.fromAccountName ?? '')} onChange={(value) => setActionValue(index, 'fromAccountName', value)} />
                      <EditableField label="Куда" value={String(action.toAccountName ?? '')} onChange={(value) => setActionValue(index, 'toAccountName', value)} />
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              disabled={!onUpdate || isProcessing}
              onClick={() => void handleSaveDraft()}
              className="rounded-2xl border border-emerald-300/20 bg-emerald-400/12 px-4 py-3 text-sm font-medium text-emerald-100 disabled:opacity-50"
            >
              {processingAction === 'save' ? 'Сохраняю...' : 'Сохранить правки'}
            </button>
          </div>
        ) : view.rows.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {view.rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm"
              >
                <span className="text-white/45">{row.label}</span>
                <span className="max-w-[62%] truncate text-right font-medium text-white/88">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className="text-xs text-emerald-100/75 transition hover:text-emerald-100"
          >
            {isEditing ? 'Скрыть редактирование' : 'Редактировать перед подтверждением'}
          </button>

          {view.rawPayload ? (
            <button
              type="button"
              onClick={() => setShowRawPayload((value) => !value)}
              className="text-xs text-white/38 transition hover:text-white/65"
            >
              {showRawPayload ? 'Скрыть технические данные' : 'Показать технические данные'}
            </button>
          ) : null}
        </div>

        {showRawPayload && view.rawPayload ? (
          <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/8 bg-black/25 p-3 text-xs text-white/55">
            {JSON.stringify(draft, null, 2)}
          </pre>
        ) : null}

        <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <Button disabled={isProcessing} onClick={handleConfirm} fullWidth>
            {processingAction === 'confirm' ? 'Выполняю...' : 'Подтвердить'}
          </Button>

          <Button
            variant="secondary"
            disabled={isProcessing}
            onClick={handleCancel}
            fullWidth
          >
            {processingAction === 'cancel' ? 'Отменяю...' : 'Отмена'}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
