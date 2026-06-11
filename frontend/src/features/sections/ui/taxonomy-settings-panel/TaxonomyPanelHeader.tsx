import type { TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
};

export function TaxonomyPanelHeader({ t }: Props) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {t('settings.taxonomy.eyebrow')}
      </div>
      <div className="mt-3 text-xl font-semibold text-white">
        {t('settings.taxonomy.title')}
      </div>
      <p className="mt-2 text-sm leading-6 text-white/55">
        {t('settings.taxonomy.caption')}
      </p>
    </div>
  );
}
