import type { TaxonomyCategoryType, TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  value: TaxonomyCategoryType;
  onChange: (type: TaxonomyCategoryType) => void;
};

const TYPES: TaxonomyCategoryType[] = ['expense', 'income', 'both'];

function getTypeLabel(t: TranslateFn, type: TaxonomyCategoryType) {
  if (type === 'expense') return t('settings.taxonomy.type.expense');
  if (type === 'income') return t('settings.taxonomy.type.income');
  return t('settings.taxonomy.type.both');
}

export function TaxonomyTypeToggle({ t, value, onChange }: Props) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`rounded-full border px-3 py-1.5 text-xs ${
            value === type
              ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50'
              : 'border-white/10 bg-white/[0.04] text-white/45'
          }`}
        >
          {getTypeLabel(t, type)}
        </button>
      ))}
    </div>
  );
}
