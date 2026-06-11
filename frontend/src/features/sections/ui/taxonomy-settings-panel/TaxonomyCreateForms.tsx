import type { FormEvent } from 'react';
import type { SectionDto } from '@/features/sections/api/sections.api';
import type { TaxonomyCategoryType, TranslateFn } from './taxonomySettingsPanel.types';
import { TaxonomyCreateCategoryForm } from './TaxonomyCreateCategoryForm';
import { TaxonomyCreateSectionForm } from './TaxonomyCreateSectionForm';

type Props = {
  t: TranslateFn;
  sections: SectionDto[];
  sectionIcon: string;
  sectionName: string;
  categoryIcon: string;
  categoryName: string;
  categoryType: TaxonomyCategoryType;
  selectedSectionId: string | null;
  isCreating: boolean;
  onSectionIconChange: (value: string) => void;
  onSectionNameChange: (value: string) => void;
  onCategoryIconChange: (value: string) => void;
  onCategoryNameChange: (value: string) => void;
  onCategoryTypeChange: (type: TaxonomyCategoryType) => void;
  onSectionSelect: (sectionId: string | null) => void;
  onCreateSection: (event: FormEvent<HTMLFormElement>) => void;
  onCreateCategory: (event: FormEvent<HTMLFormElement>) => void;
};

export function TaxonomyCreateForms({
  t,
  sections,
  sectionIcon,
  sectionName,
  categoryIcon,
  categoryName,
  categoryType,
  selectedSectionId,
  isCreating,
  onSectionIconChange,
  onSectionNameChange,
  onCategoryIconChange,
  onCategoryNameChange,
  onCategoryTypeChange,
  onSectionSelect,
  onCreateSection,
  onCreateCategory,
}: Props) {
  return (
    <div className="mt-4 grid min-w-0 gap-3">
      <TaxonomyCreateSectionForm
        t={t}
        sectionIcon={sectionIcon}
        sectionName={sectionName}
        isCreating={isCreating}
        onSectionIconChange={onSectionIconChange}
        onSectionNameChange={onSectionNameChange}
        onSubmit={onCreateSection}
      />
      <TaxonomyCreateCategoryForm
        t={t}
        sections={sections}
        categoryIcon={categoryIcon}
        categoryName={categoryName}
        categoryType={categoryType}
        selectedSectionId={selectedSectionId}
        isCreating={isCreating}
        onCategoryIconChange={onCategoryIconChange}
        onCategoryNameChange={onCategoryNameChange}
        onCategoryTypeChange={onCategoryTypeChange}
        onSectionSelect={onSectionSelect}
        onSubmit={onCreateCategory}
      />
    </div>
  );
}
