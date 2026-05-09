import { useMemo, useState } from 'react';

import { Button, Surface } from '@/shared/ui';
import { formatTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';
import { getPendingActionView } from '@/features/pending-actions/lib/pendingActionView';

type DraftAction = Record<string, any>;

type Props = {
  item: PendingActionItem;
  onConfirm: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
  onUpdate?: (id: string, parsed: Record<string, unknown>) => Promise<void> | void;
};

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'savings', label: 'Накопления' },
  { value: 'investment', label: 'Инвестиции' },
];

const CURRENCIES = ['RUB', 'USD', 'EUR', 'VND'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getDraftFromItem(item: PendingActionItem): DraftAction {
  const parsed = isRecord(item.parsed) ? item.parsed : isRecord(item.payload) ? item.payload : {};
  const intent = String(parsed.intent || parsed.type || item.intent || item.type || 'unknown');

  if (intent === 'batch') {
    const actions = Array.isArray(parsed.actions) ? parsed.actions.filter(isRecord) : [];
    return { intent: 'batch', actions: clone(actions) };
  }

  return {
    intent,
    ...clone(parsed),
  };
}

function getActions(draft: DraftAction): DraftAction[] {
  if (draft.intent === 'batch') {
    return Array.isArray(draft.actions) ? draft.actions : [];
  }

  return [draft];
}

function buildPayload(draft: DraftAction): Record<string, unknown> {
  if (draft.intent === 'batch') {
    return {
      intent: 'batch',
      actions: getActions(draft).map((action) => ({ ...action })),
    };
  }

  return { ...draft };
}

function actionTitle(action: DraftAction, index: number) {
  const intent = String(action.intent || action.type || '').toLowerCase();
  if (intent === 'create_account') return `${index + 1}. Счёт`;
  if (intent === 'income') return `${index + 1}. Доход`;
  if (intent === 'expense') return `${index + 1}. Расход`;
  if (intent === 'transfer') return `${index + 1}. Перевод`;
  if (intent === 'create_category') return `${index + 1}. Категория`;
  if (intent === 'create_section') return `${index + 1}. Раздел`;
  return `${index + 1}. Действие`;
}

function actionSummary(action: DraftAction) {
  const intent = String(action.intent || action.type || '').toLowerCase();
  if (intent === 'create_account') return `${action.name || 'Новый счёт'} · ${action.currency || 'RUB'}`;
  if (intent === 'income' || intent === 'expense') return `${action.accountName || 'счёт'} · ${action.amount || 0} ₽`;
  if (intent === 'transfer') return `${action.fromAccountName || 'счёт'} → ${action.toAccountName || 'счёт'} · ${action.amount || 0}`;
  if (intent === 'create_category') return `${action.name || 'категория'} · ${action.type || 'expense'}`;
  if (intent === 'create_section') return `${action.name || 'раздел'}`;
  return 'Проверь параметры';
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-white/45">
      {label}
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border border-white/8 bg-black/25 px-3 text-base text-white outline-none transition focus:border-emerald-300/35"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string | undefined;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-white/45">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border border-white/8 bg-black/25 px-3 text-base text-white outline-none transition focus:border-emerald-300/35"
      >
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function EditableAction({ action, onChange }: { action: DraftAction; onChange: (next: DraftAction) => void }) {
  const intent = String(action.intent || action.type || '').toLowerCase();
  const patch = (key: string, value: unknown) => onChange({ ...action, [key]: value });

  if (intent === 'create_account') {
    return (
      <div className="grid gap-3">
        <Field label="Название счёта" value={action.name} onChange={(value) => patch('name', value)} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Тип" value={action.type || 'cash'} options={ACCOUNT_TYPES} onChange={(value) => patch('type', value)} />
          <SelectField label="Валюта" value={action.currency || 'RUB'} options={CURRENCIES} onChange={(value) => patch('currency', value)} />
        </div>
        <Field label="Начальный баланс" type="number" value={action.balance ?? 0} onChange={(value) => patch('balance', Number(value) || 0)} />
      </div>
    );
  }

  if (intent === 'income' || intent === 'expense') {
    return (
      <div className="grid gap-3">
        <Field label="Сумма" type="number" value={action.amount} onChange={(value) => patch('amount', Number(value) || 0)} />
        <Field label="Счёт" value={action.accountName} onChange={(value) => patch('accountName', value)} />
        <Field label={intent === 'income' ? 'Тип дохода' : 'Категория'} value={action.rawCategory || action.categoryName} onChange={(value) => patch('rawCategory', value)} />
        <Field label="Описание" value={action.description} onChange={(value) => patch('description', value)} />
      </div>
    );
  }

  if (intent === 'transfer') {
    return (
      <div className="grid gap-3">
        <Field label="Сумма" type="number" value={action.amount} onChange={(value) => patch('amount', Number(value) || 0)} />
        <Field label="Откуда" value={action.fromAccountName} onChange={(value) => patch('fromAccountName', value)} />
        <Field label="Куда" value={action.toAccountName} onChange={(value) => patch('toAccountName', value)} />
      </div>
    );
  }

  if (intent === 'create_category') {
    return (
      <div className="grid gap-3">
        <Field label="Название категории" value={action.name} onChange={(value) => patch('name', value)} />
        <SelectField label="Тип" value={action.type || 'expense'} options={[{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }]} onChange={(value) => patch('type', value)} />
        <Field label="Раздел" value={action.sectionName} onChange={(value) => patch('sectionName', value)} />
      </div>
    );
  }

  if (intent === 'create_section') {
    return <Field label="Название раздела" value={action.name} onChange={(value) => patch('name', value)} />;
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/55">
      Это действие можно подтвердить или отменить. Редактирование для него пока не требуется.
    </div>
  );
}

export function PendingActionCard({ item, onConfirm, onCancel, onUpdate }: Props) {
  const [processingAction, setProcessingAction] = useState<'confirm' | 'cancel' | 'save' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const initialDraft = useMemo(() => getDraftFromItem(item), [item]);
  const [draft, setDraft] = useState<DraftAction>(initialDraft);

  const view = getPendingActionView({ ...item, parsed: buildPayload(draft) });
  const isProcessing = processingAction !== null;
  const actions = getActions(draft);

  const updateAction = (index: number, next: DraftAction) => {
    if (draft.intent === 'batch') {
      const nextActions = actions.map((action, actionIndex) => actionIndex === index ? next : action);
      setDraft({ ...draft, actions: nextActions });
      return;
    }
    setDraft(next);
  };

  const handleSave = async () => {
    if (!onUpdate || isProcessing) return;
    setProcessingAction('save');
    try {
      await onUpdate(item.id, buildPayload(draft));
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
      if (onUpdate) await onUpdate(item.id, buildPayload(draft));
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
                Проверь действие
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/35">{view.intentLabel}</div>
            <div className="mt-1 text-lg font-semibold leading-snug text-white">{view.title}</div>
          </div>
          <div className="shrink-0 text-[11px] text-white/35">{item.createdAt ? formatTime(item.createdAt) : '—'}</div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-white/76">
          <span className="text-amber-100">ИИ понял так:</span> {view.explanation}
        </div>

        <div className="mt-3 grid gap-2">
          {actions.map((action, index) => (
            <div key={`${index}-${action.intent || action.type}`} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/45">{actionTitle(action, index)}</span>
                <span className="max-w-[62%] truncate text-right font-medium text-white/88">{actionSummary(action)}</span>
              </div>
              {isEditing ? (
                <div className="mt-3">
                  <EditableAction action={action} onChange={(next) => updateAction(index, next)} />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {onUpdate ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setIsEditing((value) => !value)} className="rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white">
              {isEditing ? 'Скрыть редактирование' : 'Исправить перед подтверждением'}
            </button>
            {isEditing ? (
              <button type="button" onClick={handleSave} disabled={isProcessing} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-2 text-sm text-emerald-100 transition hover:bg-emerald-300/15 disabled:opacity-60">
                {processingAction === 'save' ? 'Сохраняю...' : 'Сохранить правки'}
              </button>
            ) : null}
          </div>
        ) : null}

        <details className="mt-3 text-xs text-white/35">
          <summary className="cursor-pointer select-none">Технические данные</summary>
          <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/8 bg-black/25 p-3 text-xs text-white/55">{JSON.stringify(buildPayload(draft), null, 2)}</pre>
        </details>

        <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <Button disabled={isProcessing} onClick={handleConfirm} fullWidth>{processingAction === 'confirm' ? 'Выполняю...' : 'Подтвердить'}</Button>
          <Button variant="secondary" disabled={isProcessing} onClick={handleCancel} fullWidth>{processingAction === 'cancel' ? 'Отменяю...' : 'Отмена'}</Button>
        </div>
      </div>
    </Surface>
  );
}
