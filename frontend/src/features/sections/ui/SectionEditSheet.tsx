import { useEffect, useMemo, useState } from 'react';
import type { SectionDto } from '@/features/sections/api/sections.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

type Props = {
  open: boolean;
  section?: SectionDto | null;
  isSaving?: boolean;
  modalLayer?: number;
  onClose: () => void;
  onSave: (payload: { name: string }) => Promise<void> | void;
  onDelete?: (section: SectionDto) => Promise<void> | void;
};

export function SectionEditSheet({ open, section, isSaving = false, modalLayer, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(section?.name ?? '');
    setError(null);
  }, [open, section]);

  const canSave = useMemo(() => name.trim().length >= 2 && !isSaving, [name, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError('Название должно быть не короче двух символов.');
      return;
    }
    await onSave({ name: name.trim() });
    onClose();
  };

  const remove = async () => {
    if (!section || !onDelete) return;
    if (!window.confirm(`Удалить раздел «${section.name}»? Категории останутся без раздела.`)) return;
    await onDelete(section);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={section ? 'Раздел' : 'Новый раздел'}
      subtitle="Иконка и цвет раздела подбираются автоматически по названию."
      layer={modalLayer}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {section && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="app-field">
          <span>Название</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Дом" autoFocus />
        </label>
        <div className="app-inline-hint">Иконка и цвет появятся автоматически после сохранения.</div>
        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
