import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';

import { Button, Surface } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/lib/i18n';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { getPendingActionView } from '@/features/pending-actions/lib/pendingActionView';

type EditableAction = Record<string, unknown>;

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
  onUpdate?: (id: string, parsed: Record<string, unknown>, command?: string) => Promise<void> | void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readParsed(item: PendingActionItem): Record<string, unknown> {
  if (isRecord(item.parsed)) return item.parsed;
  if (isRecord(item.payload)) return item.payload;
  return {};
}

function getActions(parsed: Record<string, unknown>): EditableAction[] {
  if (parsed.intent === 'batch' && Array.isArray(parsed.actions)) {
    return parsed.actions.filter(isRecord);
  }
  return [parsed].filter((entry) => Object.keys(entry).length > 0);
}

function getActionInput(action: EditableAction) {
  return isRecord(action.input) ? action.input : action;
}

function getActionTool(action: EditableAction) {
  return String(action.tool || action.intent || getActionInput(action).kind || '').toLowerCase();
}

const fieldLabels: Record<string, string> = {
  name: 'Название',
  type: 'Тип',
  kind: 'Тип',
  currency: 'Валюта',
  balance: 'Баланс',
  initialBalance: 'Баланс',
  amount: 'Сумма',
  category: 'Категория',
  rawCategory: 'Категория',
  description: 'Описание',
  account: 'Счёт',
  accountName: 'Счёт',
  fromAccount: 'Откуда',
  fromAccountName: 'Откуда',
  toAccount: 'Куда',
  toAccountName: 'Куда',
  section: 'Категория',
  sectionName: 'Категория',
};

const editableFieldsByIntent: Record<string, string[]> = {
  create_account: ['name', 'type', 'currency', 'initialBalance'],
  income: ['amount', 'account', 'category', 'section', 'description'],
  expense: ['amount', 'account', 'category', 'section', 'description'],
  create_transaction: ['amount', 'account', 'category', 'section', 'description'],
  update_transaction: ['amount', 'account', 'category', 'section', 'description'],
  transfer_money: ['amount', 'fromAccount', 'toAccount'],
  transfer: ['amount', 'fromAccount', 'toAccount'],
  create_category: ['name', 'type', 'sectionName'],
  create_section: ['name'],
};

function normalizeInputValue(value: unknown) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function coerceValue(key: string, value: string): unknown {
  if (key === 'amount' || key === 'balance' || key === 'initialBalance') {
    const number = Number(value.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : value;
  }
  return value.trim();
}

function rebuildParsed(original: Record<string, unknown>, actions: EditableAction[]): Record<string, unknown> {
  if (original.intent === 'batch') {
    return { ...original, actions };
  }
  return actions[0] ? { ...original, ...actions[0] } : original;
}

function updateNestedActionField(action: EditableAction, key: string, value: string) {
  if (isRecord(action.input)) {
    return {
      ...action,
      input: {
        ...action.input,
        [key]: coerceValue(key, value),
      },
    };
  }

  return { ...action, [key]: coerceValue(key, value) };
}

export function PendingActionCard({ item, onConfirm, onCancel, onUpdate }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | 'save' | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { language } = useI18n();
  const view = getPendingActionView(item, language);
  const originalParsed = useMemo(() => readParsed(item), [item]);
  const [actions, setActions] = useState<EditableAction[]>(() => getActions(originalParsed));
  const isProcessing = processingAction !== null;

  const updateActionField = (index: number, key: string, value: string) => {
    setActions((current) =>
      current.map((action, actionIndex) =>
        actionIndex === index ? updateNestedActionField(action, key, value) : action,
      ),
    );
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isProcessing) return;
    setProcessingAction('confirm');
    try {
      await onConfirm(item.id);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancel = async (event: MouseEvent<HTMLButtonElement>) => {
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

  const handleSave = async () => {
    if (!onUpdate || isProcessing) return;
    setProcessingAction('save');
    try {
      await onUpdate(item.id, rebuildParsed(originalParsed, actions), item.command);
      setShowEditor(false);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <Surface className="overflow-hidden border-emerald-300/16 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),rgba(255,255,255,0.045)]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/85">
                Проверь
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

            <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/35">
              {view.intentLabel}
            </div>

            <div className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white">
              {view.amountLabel || view.title}
            </div>

            {view.amountLabel ? (
              <div className="mt-1 text-sm leading-5 text-white/65">{view.title}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/72">
          {view.explanation}
        </div>

        {view.rows.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {view.rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm"
              >
                <span className="text-white/45">{row.label}</span>
                <span className="max-w-[62%] truncate text-right font-medium text-white/88">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {onUpdate ? (
          <button
            type="button"
            onClick={() => setShowEditor((value) => !value)}
            className="pending-action-card__edit-toggle"
          >
            {showEditor ? 'Скрыть правки' : 'Изменить'}
          </button>
        ) : null}

        {showEditor ? (
          <div className="pending-action-card__editor">
            {actions.map((action, index) => {
              const intent = getActionTool(action);
              const input = getActionInput(action);
              const fields = editableFieldsByIntent[intent]
                ?? editableFieldsByIntent[String(input.kind || '').toLowerCase()]
                ?? Object.keys(input).filter((key) => !key.startsWith('__') && key !== 'intent' && key !== 'tool');

              return (
                <div key={`${intent}-${index}`} className="pending-action-card__editor-action">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">
                    {view.actionCount > 1 ? `${index + 1}. ` : ''}{intent || 'действие'}
                  </div>

                  <div className="grid gap-2">
                    {fields.map((field) => (
                      <label key={field} className="grid gap-1.5 text-xs text-white/45">
                        {fieldLabels[field] ?? field}
                        <input
                          value={normalizeInputValue(input[field])}
                          onChange={(event) => updateActionField(index, field, event.target.value)}
                          className="h-10 rounded-2xl border border-white/10 bg-black/28 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <Button disabled={isProcessing || !onUpdate} onClick={handleSave} fullWidth>
              {processingAction === 'save' ? 'Сохраняю...' : 'Сохранить'}
            </Button>
          </div>
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
