import { useEffect, useMemo, useState } from 'react';
import type { GoalDto } from '@/features/goals/api/goals.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { useI18n } from '@/shared/lib/i18n';

type GoalSavePayload = {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  note?: string | null;
  autoSavePercent?: number;
};

type Props = {
  open: boolean;
  goal?: GoalDto | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: GoalSavePayload) => Promise<void> | void;
  onDelete?: (goal: GoalDto) => Promise<void> | void;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function GoalEditSheet({ open, goal, isSaving = false, onClose, onSave, onDelete }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [autoSavePercent, setAutoSavePercent] = useState('0');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setTargetAmount(goal ? String(goal.targetAmount ?? '') : '');
    setCurrentAmount(goal ? String(goal.currentAmount ?? 0) : '0');
    setCurrency(goal?.currency ?? 'RUB');
    setAutoSavePercent(goal ? String(goal.autoSavePercent ?? 0) : '0');
    setNote(goal?.note ?? '');
    setError(null);
  }, [open, goal]);

  const parsedTarget = Number(targetAmount.replace(',', '.'));
  const parsedCurrent = Number(currentAmount.replace(',', '.'));
  const parsedAutoSavePercent = Number(autoSavePercent.replace(',', '.'));
  const canSave = useMemo(() => title.trim().length >= 2 && Number.isFinite(parsedTarget) && parsedTarget > 0 && !isSaving, [title, parsedTarget, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError(t('goal.edit.error.required'));
      return;
    }
    await onSave({
      title: title.trim(),
      targetAmount: Math.round(parsedTarget),
      currentAmount: Number.isFinite(parsedCurrent) ? Math.max(0, Math.round(parsedCurrent)) : 0,
      currency,
      autoSavePercent: clampPercent(parsedAutoSavePercent),
      note: note.trim() || null,
    });
    onClose();
  };

  const remove = async () => {
    if (!goal || !onDelete) return;
    if (!window.confirm(t('goal.edit.confirmDelete', { title: goal.title }))) return;
    await onDelete(goal);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={goal ? t('goal.edit.title.edit') : t('goal.edit.title.create')}
      subtitle={t('goal.edit.subtitle')}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {goal && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>{t('goal.edit.delete')}</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('goal.edit.cancel')}</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? t('goal.edit.saving') : t('goal.edit.save')}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="app-field">
          <span>{t('goal.edit.name')}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('goal.edit.namePlaceholder')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="app-field">
            <span>{t('goal.edit.target')}</span>
            <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="120000" />
          </label>
          <label className="app-field">
            <span>{t('goal.edit.current')}</span>
            <input inputMode="decimal" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} placeholder="0" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="app-field">
            <span>{t('goal.edit.currency')}</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="app-field">
            <span>{t('goal.edit.autoSavePercent')}</span>
            <input inputMode="numeric" value={autoSavePercent} onChange={(event) => setAutoSavePercent(event.target.value)} placeholder="10" />
          </label>
        </div>

        <div className="goal-linked-account-note">
          <strong>{goal?.account?.name ?? t('goal.edit.accountWillBeCreated')}</strong>
          <span>{t('goal.edit.accountHint')}</span>
        </div>

        <label className="app-field">
          <span>{t('goal.edit.note')}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('goal.edit.notePlaceholder')} />
        </label>
        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
