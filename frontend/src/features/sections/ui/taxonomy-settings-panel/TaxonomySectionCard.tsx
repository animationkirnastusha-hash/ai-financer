import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import type { TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  section: SectionDto;
  categories: CategoryDto[];
};

export function TaxonomySectionCard({ t, section, categories }: Props) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-white">
          {section.icon ? `${section.icon} ` : ''}{section.name}
        </div>
        <div className="text-xs text-white/35">
          {t('settings.taxonomy.category.count', { count: categories.length })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {categories.length > 0 ? (
          categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65"
            >
              {category.icon ? `${category.icon} ` : ''}{category.name}
            </span>
          ))
        ) : (
          <span className="text-xs text-white/35">{t('settings.taxonomy.category.empty')}</span>
        )}
      </div>
    </div>
  );
}
