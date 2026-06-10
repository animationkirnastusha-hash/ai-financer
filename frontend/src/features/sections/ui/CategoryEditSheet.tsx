import { useEffect, useMemo, useState } from 'react';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { resolveCategoryIcon } from '@/features/sections/lib/categoryIcons';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

const typeOptions: Array<{ value: 'expense' | 'income' | 'both'; label: string }> = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
  { value: 'both', label: 'Оба' },
];

type Props = {
  open: boolean;
  category?: CategoryDto | null;
  sections: SectionDto[];
  isSaving?: boolean;
  initialType?: 'expense' | 'income' | 'both';
  initialSectionId?: string | null;
  initialName?: string | null;
  prefillName?: string | null;
  modalLayer?: number;
  onClose: () => void;
  onSave: (payload: { name: string; type: 'expense' | 'income' | 'both'; sectionId?: string | null }) => Promise<void> | void;
  onDelete?: (category: CategoryDto) => Promise<void> | void;
};

export function CategoryEditSheet({ open, category, sections, isSaving = false, initialType = 'expense', initialSectionId = null, initialName = null, prefillName = null, modalLayer, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? initialName ?? prefillName ?? '');
    setType(category?.type === 'income' || category?.type === 'expense' || category?.type === 'both' ? category.type : initialType);
    setSectionId(category?.sectionId ?? initialSectionId ?? null);
    setError(null);
  }, [open, category, initialType, initialSectionId, initialName, prefillName]);

  const suggested = useMemo(() => resolveCategoryIcon(name || initialName || prefillName || 'категория', type === 'income' ? 'income' : 'expense'), [name, initialName, prefillName, type]);
  const selectedSection = sectionId ? sections.find((section) => section.id === sectionId) ?? null : null;
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
      subtitle="Введи название — иконка, цвет и раздел подберутся сами."
      layer={modalLayer}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          {category && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>}
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="app-field">
          <span>Название</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Кофе" autoFocus />
        </label>

        <div className="app-taxonomy-category-preview">
          <div className="app-taxonomy-category-preview__row">
            <span className="app-taxonomy-category-preview__label">Как будет выглядеть</span>
            <span className="app-taxonomy-category-preview__pill">{selectedSection ? 'Раздел выбран' : 'Раздел автоматически'}</span>
          </div>
          <div className="app-taxonomy-category-preview__row">
            <span className="app-taxonomy-category-preview__value">
              <i className="app-taxonomy-category-preview__icon" style={{ background: suggested.color }}>{suggested.icon}</i>
              {name.trim() || suggested.sectionName}
            </span>
            <span className="app-taxonomy-category-preview__pill">
              {selectedSection ? `${selectedSection.icon ? `${selectedSection.icon} ` : ''}${selectedSection.name}` : `${suggested.sectionIcon} ${suggested.sectionName}`}
            </span>
          </div>
        </div>

        <label className="app-field">
          <span>Раздел</span>
          <select value={sectionId ?? ''} onChange={(event) => setSectionId(event.target.value || null)}>
            <option value="">Подобрать автоматически</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.icon ? `${section.icon} ` : ''}{section.name}</option>)}
          </select>
        </label>

        <div>
          <div className="mb-2 text-xs text-white/42">Тип</div>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setType(option.value)} className={type === option.value ? 'app-choice app-choice--active' : 'app-choice'}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}
