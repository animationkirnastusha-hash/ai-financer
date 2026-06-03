import { useEffect, useMemo, useState } from 'react';
import type { SectionDto } from '@/features/sections/api/sections.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { resolveSectionIcon } from '@/features/sections/lib/categoryIcons';

type Props = {
  open: boolean;
  section?: SectionDto | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; description?: string | null }) => Promise<void> | void;
  onDelete?: (section: SectionDto) => Promise<void> | void;
};

export function SectionEditSheet({ open, section, isSaving = false, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(section?.name ?? '');
    setDescription(section?.description ?? '');
    setError(null);
  }, [open, section]);

  const suggestion = useMemo(() => resolveSectionIcon(name || section?.name || ''), [name, section?.name]);
  const canSave = useMemo(() => name.trim().length >= 2 && !isSaving, [name, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError('Название должно быть не короче двух символов.');
      return;
    }
    await onSave({ name: name.trim(), description: description.trim() || null });
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
      subtitle="Иконка и цвет подбираются автоматически по названию раздела."
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {section && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="app-auto-taxonomy-preview">
          <span style={{ background: suggestion.color }}>{suggestion.icon}</span>
          <div>
            <b>{name.trim() || 'Раздел'}</b>
            <small>Фина подберёт визуальный стиль автоматически</small>
          </div>
        </div>

        <label className="app-field">
          <span>Название</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Продукты" />
        </label>

        <label className="app-field">
          <span>Описание</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что относится к этому разделу" />
        </label>
        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
