import { useEffect, useMemo, useState } from 'react';
import type { GoalDto } from '@/features/goals/api/goals.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

type Props = {
  open: boolean;
  goal?: GoalDto | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; targetAmount: number; currentAmount?: number; currency?: string; note?: string | null }) => Promise<void> | void;
  onDelete?: (goal: GoalDto) => Promise<void> | void;
};

export function GoalEditSheet({ open, goal, isSaving = false, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setTargetAmount(goal ? String(goal.targetAmount ?? '') : '');
    setCurrentAmount(goal ? String(goal.currentAmount ?? 0) : '0');
    setCurrency(goal?.currency ?? 'RUB');
    setNote(goal?.note ?? '');
    setError(null);
  }, [open, goal]);

  const parsedTarget = Number(targetAmount.replace(',', '.'));
  const parsedCurrent = Number(currentAmount.replace(',', '.'));
  const canSave = useMemo(() => title.trim().length >= 2 && Number.isFinite(parsedTarget) && parsedTarget > 0 && !isSaving, [title, parsedTarget, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError('Укажи название и сумму цели.');
      return;
    }
    await onSave({
      title: title.trim(),
      targetAmount: Math.round(parsedTarget),
      currentAmount: Number.isFinite(parsedCurrent) ? Math.max(0, Math.round(parsedCurrent)) : 0,
      currency,
      note: note.trim() || null,
    });
    onClose();
  };

  const remove = async () => {
    if (!goal || !onDelete) return;
    if (!window.confirm(`Удалить цель «${goal.title}»?`)) return;
    await onDelete(goal);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={goal ? 'Цель' : 'Новая цель'}
      subtitle="Короткая форма. Можно также сказать: “создай цель отпуск 120000”."
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {goal && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="app-field">
          <span>Название</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Отпуск" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="app-field">
            <span>Цель</span>
            <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="120000" />
          </label>
          <label className="app-field">
            <span>Сейчас</span>
            <input inputMode="decimal" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} placeholder="0" />
          </label>
        </div>
        <label className="app-field">
          <span>Валюта</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="app-field">
          <span>Заметка</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Для чего эта цель" />
        </label>
        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
