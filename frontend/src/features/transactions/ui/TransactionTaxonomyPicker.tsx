import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useI18n } from '@/shared/lib/i18n';

type TransactionKind = 'income' | 'expense';

type Props = {
  type: TransactionKind;
  title: string;
  description?: string;
  categoryId: string;
  onCategoryIdChange: (categoryId: string) => void;
};

function supportsType(categoryType: string | null | undefined, kind: TransactionKind) {
  return !categoryType || categoryType === 'both' || categoryType === kind;
}

export function TransactionTaxonomyPicker({ type, categoryId, onCategoryIdChange }: Props) {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const categories = useSectionsStore((state) => state.categories);
  const sections = useSectionsStore((state) => state.sections);
  const loadAll = useSectionsStore((state) => state.loadAll);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const availableCategories = useMemo(
    () => categories.filter((category) => supportsType(category.type, type)),
    [categories, type],
  );

  const selectedCategory = availableCategories.find((category) => category.id === categoryId) ?? null;
  const selectedSection = selectedCategory?.sectionId
    ? sections.find((section) => section.id === selectedCategory.sectionId) ?? selectedCategory.section ?? null
    : null;

  const sectionLabel = selectedSection
    ? `${selectedSection.icon ? `${selectedSection.icon} ` : ''}${selectedSection.name}`
    : t('transaction.category.auto');

  const categoryLabel = selectedCategory
    ? `${selectedCategory.icon ? `${selectedCategory.icon} ` : ''}${selectedCategory.name}`
    : t('transaction.category.auto');

  const createCategory = () => {
    openModal({
      type: 'category-edit',
      initialType: type,
      onSavedCategory: (category) => onCategoryIdChange(category.id),
    });
  };

  return (
    <section className="app-taxonomy-picker" data-no-swipe="true">
      <div className="app-taxonomy-picker__head">
        <div>
          <div className="app-taxonomy-picker__eyebrow">{t('transaction.category.label')}</div>
          <div className="app-taxonomy-picker__title">{categoryLabel}</div>
        </div>
        <button type="button" className="app-taxonomy-picker__create" onClick={createCategory}>
          {t('transaction.category.create')}
        </button>
      </div>

      <div className="app-taxonomy-picker__meta">
        <span>{t('transaction.category.section')}: {sectionLabel}</span>
        <span>{selectedCategory ? t('transaction.category.selected') : t('transaction.category.prediction')}</span>
      </div>

      <label className="app-field app-taxonomy-picker__select">
        <span>{t('transaction.category.choose')}</span>
        <select value={categoryId} onChange={(event) => onCategoryIdChange(event.target.value)}>
          <option value="">{t('transaction.category.auto')}</option>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ''}{category.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
