import type { CategoryDto } from '@/features/sections/api/sections.api';
import type { TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  categories: CategoryDto[];
};

export function TaxonomyLooseCategories({ t, categories }: Props) {
  if (categories.length === 0) return null;

  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
      <div className="font-medium text-white">{t('settings.taxonomy.noSection')}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category.id}
            className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65"
          >
            {category.icon ? `${category.icon} ` : ''}{category.name}
          </span>
        ))}
      </div>
    </div>
  );
}
