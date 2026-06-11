import type { CategoryPreset, SectionPreset, TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  sectionPresets: SectionPreset[];
  categoryPresets: CategoryPreset[];
  onEnsureSection: (preset: SectionPreset) => void;
  onEnsureCategory: (preset: CategoryPreset) => void;
};

export function TaxonomyPresetActions({
  t,
  sectionPresets,
  categoryPresets,
  onEnsureSection,
  onEnsureCategory,
}: Props) {
  return (
    <div className="mt-4 rounded-[24px] border border-emerald-300/12 bg-emerald-300/8 p-3">
      <div className="text-sm font-medium text-emerald-50">{t('settings.taxonomy.presets.title')}</div>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {sectionPresets.map((preset) => (
          <button
            key={preset.nameKey}
            type="button"
            onClick={() => onEnsureSection(preset)}
            className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-left text-xs text-white/72"
          >
            <span className="mr-1">{preset.icon}</span>{t(preset.nameKey)}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {categoryPresets.map((preset) => (
          <button
            key={preset.nameKey}
            type="button"
            onClick={() => onEnsureCategory(preset)}
            className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-left text-xs text-white/72"
          >
            <span className="mr-1">{preset.icon}</span>{t(preset.nameKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
