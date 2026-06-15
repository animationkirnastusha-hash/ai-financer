import { useMemo, useState } from 'react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type Preset = {
  nameKey: I18nKey;
  icon: string;
  descriptionKey: I18nKey;
};

const PRESETS: Preset[] = [
  { nameKey: 'sections.create.preset.home.name', icon: '🏠', descriptionKey: 'sections.create.preset.home.description' },
  { nameKey: 'sections.create.preset.fun.name', icon: '✨', descriptionKey: 'sections.create.preset.fun.description' },
  { nameKey: 'sections.create.preset.work.name', icon: '💼', descriptionKey: 'sections.create.preset.work.description' },
  { nameKey: 'sections.create.preset.subscriptions.name', icon: '🔁', descriptionKey: 'sections.create.preset.subscriptions.description' },
];

type Props = {
  open: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; icon?: string | null; description?: string | null }) => Promise<void>;
};

export function CreateSectionSheet({ open, isCreating, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [description, setDescription] = useState('');

  const canSubmit = useMemo(() => name.trim().length >= 2 && !isCreating, [name, isCreating]);

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim(),
      icon: icon.trim() || null,
      description: description.trim() || null,
    });
    setName('');
    setIcon('🏠');
    setDescription('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('sections.create.title')}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-white/55">{t('sections.create.caption')}</p>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const presetName = t(preset.nameKey);
            const presetDescription = t(preset.descriptionKey);
            return (
              <button
                key={preset.nameKey}
                type="button"
                onClick={() => {
                  setName(presetName);
                  setIcon(preset.icon);
                  setDescription(presetDescription);
                }}
                className="rounded-2xl border border-white/10 bg-white/6 p-3 text-left transition hover:bg-white/10"
              >
                <div className="text-xl">{preset.icon}</div>
                <div className="mt-2 text-sm font-medium text-white">{presetName}</div>
                <div className="mt-1 text-xs leading-5 text-white/42">{presetDescription}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[72px_1fr] gap-3">
          <label className="block">
            <span className="text-xs text-white/42">{t('sections.create.icon')}</span>
            <input
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-3 text-center text-xl text-white outline-none focus:border-emerald-300/35"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/42">{t('common.name')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('sections.create.namePlaceholder')}
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-white/42">{t('sections.create.description')}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('sections.create.descriptionPlaceholder')}
            className="mt-2 min-h-[84px] w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
          />
        </label>

        <Button fullWidth disabled={!canSubmit} onClick={submit}>
          {isCreating ? t('sections.create.creating') : t('sections.create.submit')}
        </Button>
      </div>
    </BottomSheet>
  );
}
