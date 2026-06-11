import type { SectionDto } from '@/features/sections/api/sections.api';
import type { TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  sections: SectionDto[];
  selectedSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
};

export function TaxonomySectionPicker({ t, sections, selectedSectionId, onSelect }: Props) {
  return (
    <div className="mt-3 -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
          selectedSectionId === null
            ? 'border-white/30 bg-white/12 text-white'
            : 'border-white/10 bg-white/[0.04] text-white/45'
        }`}
      >
        {t('settings.taxonomy.noSection')}
      </button>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelect(section.id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
            selectedSectionId === section.id
              ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50'
              : 'border-white/10 bg-white/[0.04] text-white/45'
          }`}
        >
          {section.icon ? `${section.icon} ` : ''}{section.name}
        </button>
      ))}
    </div>
  );
}
