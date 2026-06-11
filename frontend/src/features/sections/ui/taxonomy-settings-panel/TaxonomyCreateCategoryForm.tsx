import type { FormEvent } from 'react';
import type { SectionDto } from '@/features/sections/api/sections.api';
import type { TaxonomyCategoryType, TranslateFn } from './taxonomySettingsPanel.types';
import { TaxonomySectionPicker } from './TaxonomySectionPicker';
import { TaxonomyTypeToggle } from './TaxonomyTypeToggle';

type Props = {
  t: TranslateFn;
  sections: SectionDto[];
  categoryIcon: string;
  categoryName: string;
  categoryType: TaxonomyCategoryType;
  selectedSectionId: string | null;
  isCreating: boolean;
  onCategoryIconChange: (value: string) => void;
  onCategoryNameChange: (value: string) => void;
  onCategoryTypeChange: (type: TaxonomyCategoryType) => void;
  onSectionSelect: (sectionId: string | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TaxonomyCreateCategoryForm({
  t,
  sections,
  categoryIcon,
  categoryName,
  categoryType,
  selectedSectionId,
  isCreating,
  onCategoryIconChange,
  onCategoryNameChange,
  onCategoryTypeChange,
  onSectionSelect,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="min-w-0 rounded-[24px] border border-white/8 bg-black/20 p-3">
      <div className="text-sm font-medium text-white">{t('settings.taxonomy.category.create')}</div>
      <div className="mt-3 grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
        <input
          value={categoryIcon}
          onChange={(event) => onCategoryIconChange(event.target.value)}
          placeholder="🛒"
          maxLength={4}
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center text-sm text-white outline-none placeholder:text-white/25 sm:px-3"
        />
        <input
          value={categoryName}
          onChange={(event) => onCategoryNameChange(event.target.value)}
          placeholder={t('settings.taxonomy.category.placeholder')}
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
        />
      </div>

      <TaxonomyTypeToggle t={t} value={categoryType} onChange={onCategoryTypeChange} />
      <TaxonomySectionPicker
        t={t}
        sections={sections}
        selectedSectionId={selectedSectionId}
        onSelect={onSectionSelect}
      />

      <button
        type="submit"
        disabled={!categoryName.trim() || isCreating}
        className="mt-3 block w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCreating ? t('settings.taxonomy.creating') : t('settings.taxonomy.category.add')}
      </button>
    </form>
  );
}
