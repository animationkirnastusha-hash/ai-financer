import { useEffect, useMemo, useState } from 'react';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { resolveCategoryIcon } from '@/features/sections/lib/categoryIcons';

type CategoryType = 'income' | 'expense';
type InitialCategoryType = CategoryType | 'both';

type Props = {
  open: boolean;
  category?: CategoryDto | null;
  sections: SectionDto[];
  initialType?: InitialCategoryType;
  initialSectionId?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; type: CategoryType; sectionId?: string | null }) => Promise<void> | void;
  onDelete?: (category: CategoryDto) => Promise<void> | void;
};

export function CategoryEditSheet({ open, category, sections, initialType = 'expense', initialSectionId = null, isSaving = false, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    const nextType: CategoryType = category?.type === 'income' ? 'income' : category?.type === 'expense' ? 'expense' : initialType === 'income' ? 'income' : 'expense';
    setType(nextType);
    setSectionId(category?.sectionId ?? initialSectionId ?? null);
    setError(null);
  }, [category, initialSectionId, initialType, open]);

  const suggestion = useMemo(() => resolveCategoryIcon(name || category?.name || '', type), [category?.name, name, type]);
  const canSave = useMemo(() => name.trim().length >= 2 && !isSaving, [name, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError('Название должно быть не короче двух символов.');
      return;
    }
    await onSave({ name: name.trim(), type, sectionId });
    onClose();
  };

  const remove = async () => {
    if (!category || !onDelete) return;
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) return;
    await onDelete(category);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={category ? 'Категория' : 'Новая категория'}
      subtitle="Иконка и цвет подбираются автоматически по названию."
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {category && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="app-auto-taxonomy-preview">
          <span style={{ background: suggestion.color }}>{suggestion.icon}</span>
          <div>
            <b>{name.trim() || 'Категория'}</b>
            <small>Фина подберёт иконку и цвет автоматически</small>
          </div>
        </div>

        <label className="app-field">
          <span>Название</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Колбаса" />
        </label>

        <label className="app-field">
          <span>Раздел</span>
          <select value={sectionId ?? ''} onChange={(event) => setSectionId(event.target.value || null)}>
            <option value="">Автоматически</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.icon ? `${section.icon} ` : ''}{section.name}</option>)}
          </select>
        </label>

        <div>
          <div className="mb-2 text-xs text-white/42">Тип</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType('expense')} className={type === 'expense' ? 'app-choice app-choice--active' : 'app-choice'}>Расход</button>
            <button type="button" onClick={() => setType('income')} className={type === 'income' ? 'app-choice app-choice--active' : 'app-choice'}>Доход</button>
          </div>
        </div>

        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
