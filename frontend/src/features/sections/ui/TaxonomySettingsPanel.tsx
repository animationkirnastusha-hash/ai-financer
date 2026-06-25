import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { resolveCategoryIcon } from '@/features/sections/lib/categoryIcons';
import { useI18n } from '@/shared/lib/i18n';

type CategoryType = 'expense' | 'income' | 'both';

function typeLabel(type: string | null | undefined, t: (key: string, params?: Record<string, string | number>) => string) {
  if (type === 'income') return t('sections.category.type.income');
  if (type === 'both') return t('sections.category.type.both');
  return t('sections.category.type.expense');
}

const CATEGORY_PRESETS: Array<{ name: string; icon: string; type: CategoryType }> = [
  { name: 'Продукты', icon: '🛒', type: 'expense' },
  { name: 'Кафе и рестораны', icon: '☕', type: 'expense' },
  { name: 'Транспорт', icon: '🚕', type: 'expense' },
  { name: 'Авто', icon: '⛽', type: 'expense' },
  { name: 'Здоровье', icon: '💊', type: 'expense' },
  { name: 'Подписки', icon: '🔁', type: 'expense' },
  { name: 'Зарплата', icon: '💼', type: 'income' },
  { name: 'Прочие расходы', icon: '🧾', type: 'expense' },
];

export function TaxonomySettingsPanel() {
  const { t } = useI18n();
  const { categories, isLoading, isCreating, error, loadAll, createCategory } = useSectionsStore();
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const sortedCategories = useMemo(() => [...categories].sort((left, right) => left.name.localeCompare(right.name, 'ru')), [categories]);
  const suggested = resolveCategoryIcon(categoryName || 'Категория', categoryType === 'income' ? 'income' : 'expense');

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    await createCategory({ name, type: categoryType, sectionId: null });
    setCategoryName('');
  }

  async function ensurePreset(name: string, type: CategoryType) {
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) return;
    await createCategory({ name, type, sectionId: null });
  }

  return (
    <section className="max-w-full overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/50">{t('settings.taxonomy.header.eyebrow')}</div>
          <h3 className="mt-1 text-lg font-semibold text-white">{t('settings.taxonomy.header.title')}</h3>
          <p className="mt-1 text-sm leading-5 text-white/48">{t('settings.taxonomy.header.caption')}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-right text-xs text-white/48">
          <b className="block text-base text-white">{categories.length}</b>
          {t('sections.stats.categories')}
        </div>
      </div>

      {error ? <div className="app-error-box mt-3">{error}</div> : null}

      <form onSubmit={handleCreateCategory} className="mt-4 rounded-[24px] border border-white/8 bg-black/18 p-3">
        <label className="app-field">
          <span>{t('sections.category.name')}</span>
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder={t('sections.category.namePlaceholder')} />
        </label>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] p-2 text-sm text-white/70">
          <span className="grid h-9 w-9 place-items-center rounded-2xl" style={{ background: suggested.color }}>{suggested.icon}</span>
          <span>{categoryName.trim() || suggested.categoryName}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['expense', 'income', 'both'] as const).map((type) => (
            <button key={type} type="button" onClick={() => setCategoryType(type)} className={categoryType === type ? 'app-choice app-choice--active' : 'app-choice'}>
              {typeLabel(type, t)}
            </button>
          ))}
        </div>

        <button type="submit" disabled={isCreating || categoryName.trim().length < 2} className="app-primary-button mt-3 w-full">
          {isCreating ? t('sections.category.saving') : t('sections.action.category.title')}
        </button>
      </form>

      <div className="mt-4 rounded-[24px] border border-emerald-300/12 bg-emerald-300/8 p-3">
        <div className="text-sm font-medium text-emerald-50">{t('settings.taxonomy.presets.title')}</div>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {CATEGORY_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => void ensurePreset(preset.name, preset.type)}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-left text-xs text-white/72"
            >
              <span className="mr-1">{preset.icon}</span>{preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/45">{t('settings.taxonomy.loading')}</div>
        ) : sortedCategories.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/50">{t('settings.taxonomy.empty')}</div>
        ) : sortedCategories.map((category) => (
          <div key={category.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-white/78">
              <i className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl" style={category.color ? { background: category.color } : undefined}>{category.icon || '◌'}</i>
              <b className="truncate">{category.name}</b>
            </span>
            <small className="shrink-0 text-white/42">{typeLabel(category.type, t)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
