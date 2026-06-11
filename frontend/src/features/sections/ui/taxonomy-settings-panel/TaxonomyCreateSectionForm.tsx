import type { FormEvent } from 'react';
import type { TranslateFn } from './taxonomySettingsPanel.types';

type Props = {
  t: TranslateFn;
  sectionIcon: string;
  sectionName: string;
  isCreating: boolean;
  onSectionIconChange: (value: string) => void;
  onSectionNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TaxonomyCreateSectionForm({
  t,
  sectionIcon,
  sectionName,
  isCreating,
  onSectionIconChange,
  onSectionNameChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="min-w-0 rounded-[24px] border border-white/8 bg-black/20 p-3">
      <div className="text-sm font-medium text-white">{t('settings.taxonomy.section.create')}</div>
      <div className="mt-3 grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
        <input
          value={sectionIcon}
          onChange={(event) => onSectionIconChange(event.target.value)}
          placeholder="🏠"
          maxLength={4}
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center text-sm text-white outline-none placeholder:text-white/25 sm:px-3"
        />
        <input
          value={sectionName}
          onChange={(event) => onSectionNameChange(event.target.value)}
          placeholder={t('settings.taxonomy.section.placeholder')}
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
        />
      </div>
      <button
        type="submit"
        disabled={!sectionName.trim() || isCreating}
        className="mt-3 block w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCreating ? t('settings.taxonomy.creating') : t('settings.taxonomy.section.add')}
      </button>
    </form>
  );
}
