import { useMemo, useState } from 'react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';

const PRESETS = [
  { name: 'Дом', icon: '🏠', description: 'Продукты, быт, семья и регулярные траты' },
  { name: 'Развлечения', icon: '✨', description: 'Кино, игры, бары, настроение и отдых' },
  { name: 'Работа', icon: '💼', description: 'Доходы, рабочие расходы и инструменты' },
  { name: 'Подписки', icon: '🔁', description: 'Сервисы, приложения и повторяющиеся платежи' },
];

type Props = {
  open: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; icon?: string | null; description?: string | null }) => Promise<void>;
};

export function CreateSectionSheet({ open, isCreating, onClose, onSubmit }: Props) {
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
    <BottomSheet open={open} onClose={onClose} title="Новый раздел">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-white/55">
          Раздел — это жизненный контекст: Дом, Развлечения, Работа. Его можно создать здесь или сказать AI: “создай раздел Дом”.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setName(preset.name);
                setIcon(preset.icon);
                setDescription(preset.description);
              }}
              className="rounded-2xl border border-white/10 bg-white/6 p-3 text-left transition hover:bg-white/10"
            >
              <div className="text-xl">{preset.icon}</div>
              <div className="mt-2 text-sm font-medium text-white">{preset.name}</div>
              <div className="mt-1 text-xs leading-5 text-white/42">{preset.description}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[72px_1fr] gap-3">
          <label className="block">
            <span className="text-xs text-white/42">Иконка</span>
            <input
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-3 text-center text-xl text-white outline-none focus:border-emerald-300/35"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/42">Название</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Дом"
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-white/42">Описание</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Что будет жить в этом разделе"
            className="mt-2 min-h-[84px] w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
          />
        </label>

        <Button fullWidth disabled={!canSubmit} onClick={submit}>
          {isCreating ? 'Создаю...' : 'Создать раздел'}
        </Button>
      </div>
    </BottomSheet>
  );
}
