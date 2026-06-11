import { useI18n } from '@/shared/lib/i18n';
import { TaxonomyCreateForms } from './taxonomy-settings-panel/TaxonomyCreateForms';
import { TaxonomyErrorBanner } from './taxonomy-settings-panel/TaxonomyErrorBanner';
import { TaxonomyExamples } from './taxonomy-settings-panel/TaxonomyExamples';
import { TaxonomyPanelHeader } from './taxonomy-settings-panel/TaxonomyPanelHeader';
import { TaxonomyPresetActions } from './taxonomy-settings-panel/TaxonomyPresetActions';
import { TaxonomySectionList } from './taxonomy-settings-panel/TaxonomySectionList';
import { useTaxonomySettingsPanel } from './taxonomy-settings-panel/useTaxonomySettingsPanel';

export function TaxonomySettingsPanel() {
  const { t } = useI18n();
  const panel = useTaxonomySettingsPanel(t);

  return (
    <section className="max-w-full overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
      <TaxonomyPanelHeader t={t} />
      <TaxonomyErrorBanner error={panel.error} />
      <TaxonomyCreateForms
        t={t}
        sections={panel.sections}
        sectionIcon={panel.sectionIcon}
        sectionName={panel.sectionName}
        categoryIcon={panel.categoryIcon}
        categoryName={panel.categoryName}
        categoryType={panel.categoryType}
        selectedSectionId={panel.selectedSectionId}
        isCreating={panel.isCreating}
        onSectionIconChange={panel.setSectionIcon}
        onSectionNameChange={panel.setSectionName}
        onCategoryIconChange={panel.setCategoryIcon}
        onCategoryNameChange={panel.setCategoryName}
        onCategoryTypeChange={panel.setCategoryType}
        onSectionSelect={panel.setSelectedSectionId}
        onCreateSection={panel.handleCreateSection}
        onCreateCategory={panel.handleCreateCategory}
      />
      <TaxonomyPresetActions
        t={t}
        sectionPresets={panel.sectionPresets}
        categoryPresets={panel.categoryPresets}
        onEnsureSection={(preset) => void panel.ensurePresetSection(preset)}
        onEnsureCategory={(preset) => void panel.ensurePresetCategory(preset)}
      />
      <TaxonomySectionList
        t={t}
        isLoading={panel.isLoading}
        sectionsCount={panel.sections.length}
        categoriesCount={panel.categories.length}
        categoriesBySection={panel.categoriesBySection}
        looseCategories={panel.looseCategories}
      />
      <TaxonomyExamples t={t} />
    </section>
  );
}
