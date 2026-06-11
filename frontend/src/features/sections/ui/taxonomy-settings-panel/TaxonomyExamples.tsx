import type { TranslateFn } from './taxonomySettingsPanel.types';

const EXAMPLE_KEYS = [
  'settings.taxonomy.example.section',
  'settings.taxonomy.example.category',
  'settings.taxonomy.example.rule',
  'settings.taxonomy.example.expense',
];

type Props = {
  t: TranslateFn;
};

export function TaxonomyExamples({ t }: Props) {
  return (
    <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 p-3">
      <div className="text-sm font-medium text-white">{t('settings.taxonomy.examples.title')}</div>
      <div className="mt-2 space-y-1 text-xs leading-5 text-white/45">
        {EXAMPLE_KEYS.map((key) => (
          <div key={key}>• {t(key)}</div>
        ))}
      </div>
    </div>
  );
}
