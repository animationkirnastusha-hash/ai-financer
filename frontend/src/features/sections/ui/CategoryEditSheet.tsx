import { useEffect, useMemo, useState } from 'react';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

type Props = {
  open: boolean;
  category?: CategoryDto | null;
  sections: SectionDto[];
  isSaving?: boolean;
  initialType?: 'expense' | 'income' | 'both';
  initialSectionId?: string | null;
  onClose: () => void;
  onSave: (payload: { name: string; type: 'expense' | 'income' | 'both'; sectionId?: string | null; icon?: string | null }) => Promise<void> | void;
  onDelete?: (category: CategoryDto) => Promise<void> | void;
};

const typeOptions: Array<{ value: 'expense' | 'income' | 'both'; label: string }> = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
  { value: 'both', label: 'Оба' },
];

export function CategoryEditSheet({ open, category, sections, isSaving = false, initialType = 'expense', initialSectionId = null, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '');
    setType((category?.type === 'income' || category?.type === 'both' ? category.type : initialType) as 'expense' | 'income' | 'both');
    setSectionId(category?.sectionId ?? initialSectionId ?? null);
    setError(null);
  }, [open, category, initialType, initialSectionId]);

  const canSave = useMemo(() => name.trim().length >= 2 && !isSaving, [name, isSaving]);

  const submit = async () => {
    if (!canSave) {
      setError('Название должно быть не короче двух символов.');
      return;
    }
    await onSave({ name: name.trim(), type, sectionId, icon: icon.trim() || null });
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
      subtitle="Категория нужна для диаграмм, аналитики и быстрых отчётов."
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
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Кофе" />
        </label>

        <div className="grid grid-cols-[76px_1fr] gap-3">
          <label className="app-field">
            <span>Иконка</span>
            <input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="☕" className="text-center text-xl" />
          </label>
          <label className="app-field">
            <span>Раздел</span>
            <select value={sectionId ?? ''} onChange={(event) => setSectionId(event.target.value || null)}>
              <option value="">Без раздела</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.icon ? `${section.icon} ` : ''}{section.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-2 text-xs text-white/42">Тип</div>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={type === option.value ? 'app-choice app-choice--active' : 'app-choice'}
              >
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
