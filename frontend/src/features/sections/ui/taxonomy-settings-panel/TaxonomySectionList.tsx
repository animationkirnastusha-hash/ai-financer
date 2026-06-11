import type { CategoryDto } from '@/features/sections/api/sections.api';
import type { CategoriesBySection, TranslateFn } from './taxonomySettingsPanel.types';
import { TaxonomyLooseCategories } from './TaxonomyLooseCategories';
import { TaxonomySectionCard } from './TaxonomySectionCard';

type Props = {
  t: TranslateFn;
  isLoading: boolean;
  sectionsCount: number;
  categoriesCount: number;
  categoriesBySection: CategoriesBySection[];
  looseCategories: CategoryDto[];
};

export function TaxonomySectionList({
  t,
  isLoading,
  sectionsCount,
  categoriesCount,
  categoriesBySection,
  looseCategories,
}: Props) {
  return (
    <div className="mt-4 space-y-3">
      {isLoading ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/45">
          {t('settings.taxonomy.loading')}
        </div>
      ) : sectionsCount === 0 && categoriesCount === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/50">
          {t('settings.taxonomy.empty')}
        </div>
      ) : (
        <>
          {categoriesBySection.map(({ section, categories }) => (
            <TaxonomySectionCard key={section.id} t={t} section={section} categories={categories} />
          ))}
          <TaxonomyLooseCategories t={t} categories={looseCategories} />
        </>
      )}
    </div>
  );
}
