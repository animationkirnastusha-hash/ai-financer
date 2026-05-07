import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSectionsStore } from '@/features/sections/model/sections.store';

const SECTION_PRESETS = [
  { name: 'Дом', icon: '🏠', description: 'Продукты, быт, семья, ремонт' },
  { name: 'Развлечения', icon: '🎮', description: 'Кино, игры, бар, настроение' },
  { name: 'Работа', icon: '💼', description: 'Доходы, проекты, рабочие траты' },
  { name: 'Подписки', icon: '🔁', description: 'Регулярные платежи и сервисы' },
];

const CATEGORY_PRESETS = [
  { name: 'Продукты', icon: '🛒', sectionName: 'Дом' },
  { name: 'Кофе', icon: '☕', sectionName: 'Развлечения' },
  { name: 'Такси', icon: '🚕', sectionName: 'Развлечения' },
  { name: 'Зарплата', icon: '💰', sectionName: 'Работа', type: 'income' as const },
];

export function TaxonomySettingsPanel() {
  const {
    sections,
    categories,
    isLoading,
    isCreating,
    error,
    loadAll,
    createSection,
    createCategory,
  } = useSectionsStore();

  const [sectionName, setSectionName] = useState('');
  const [sectionIcon, setSectionIcon] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [categoryType, setCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const categoriesBySection = useMemo(() => {
    return sections.map((section) => ({
      section,
      categories: categories.filter((category) => category.sectionId === section.id),
    }));
  }, [categories, sections]);

  const looseCategories = useMemo(
    () => categories.filter((category) => !category.sectionId),
    [categories],
  );

  async function handleCreateSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = sectionName.trim();
    if (!name) return;

    await createSection({
      name,
      icon: sectionIcon.trim() || null,
      description: null,
    });

    setSectionName('');
    setSectionIcon('');
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;

    await createCategory({
      name,
      icon: categoryIcon.trim() || null,
      type: categoryType,
      sectionId: selectedSectionId,
    });

    setCategoryName('');
    setCategoryIcon('');
  }

  async function ensurePresetSection(preset: (typeof SECTION_PRESETS)[number]) {
    const exists = sections.some(
      (section) => section.name.toLowerCase() === preset.name.toLowerCase(),
    );
    if (exists) return;

    await createSection({
      name: preset.name,
      icon: preset.icon,
      description: preset.description,
    });
  }

  async function ensurePresetCategory(preset: (typeof CATEGORY_PRESETS)[number]) {
    const exists = categories.some(
      (category) => category.name.toLowerCase() === preset.name.toLowerCase(),
    );
    if (exists) return;

    let section = sections.find(
      (item) => item.name.toLowerCase() === preset.sectionName.toLowerCase(),
    );

    if (!section) {
      section = await createSection({
        name: preset.sectionName,
        icon: SECTION_PRESETS.find((item) => item.name === preset.sectionName)?.icon ?? null,
      });
    }

    await createCategory({
      name: preset.name,
      icon: preset.icon,
      type: preset.type ?? 'expense',
      sectionId: section.id,
    });
  }

  return (
    <section className="max-w-full overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        Sections & categories
      </div>

      <div className="mt-3 text-xl font-semibold text-white">
        Разделы и категории
      </div>

      <p className="mt-2 text-sm leading-6 text-white/55">
        Это базовая функция. Пользователь может создать раздел или категорию вручную,
        а AI должен уметь сделать то же самое по команде: “создай раздел Дом”,
        “все продукты отправляй в Дом”.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-400/10 px-3 py-2 text-sm text-red-100/85">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-3">
        <form
          onSubmit={handleCreateSection}
          className="min-w-0 rounded-[24px] border border-white/8 bg-black/20 p-3"
        >
          <div className="text-sm font-medium text-white">Создать раздел</div>
          <div className="mt-3 grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
            <input
              value={sectionIcon}
              onChange={(event) => setSectionIcon(event.target.value)}
              placeholder="🏠"
              maxLength={4}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center text-sm text-white outline-none placeholder:text-white/25 sm:px-3"
            />
            <input
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder="Например: Дом"
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>
          <button
            type="submit"
            disabled={!sectionName.trim() || isCreating}
            className="mt-3 block w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? 'Создаю…' : 'Добавить раздел'}
          </button>
        </form>

        <form
          onSubmit={handleCreateCategory}
          className="min-w-0 rounded-[24px] border border-white/8 bg-black/20 p-3"
        >
          <div className="text-sm font-medium text-white">Создать категорию</div>
          <div className="mt-3 grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
            <input
              value={categoryIcon}
              onChange={(event) => setCategoryIcon(event.target.value)}
              placeholder="🛒"
              maxLength={4}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center text-sm text-white outline-none placeholder:text-white/25 sm:px-3"
            />
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Например: Продукты"
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['expense', 'income', 'both'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCategoryType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  categoryType === type
                    ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50'
                    : 'border-white/10 bg-white/[0.04] text-white/45'
                }`}
              >
                {type === 'expense' ? 'Расход' : type === 'income' ? 'Доход' : 'Оба'}
              </button>
            ))}
          </div>

          <div className="mt-3 -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setSelectedSectionId(null)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                selectedSectionId === null
                  ? 'border-white/30 bg-white/12 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/45'
              }`}
            >
              Без раздела
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
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

          <button
            type="submit"
            disabled={!categoryName.trim() || isCreating}
            className="mt-3 block w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? 'Создаю…' : 'Добавить категорию'}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-[24px] border border-emerald-300/12 bg-emerald-300/8 p-3">
        <div className="text-sm font-medium text-emerald-50">Быстрый старт</div>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {SECTION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => void ensurePresetSection(preset)}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-left text-xs text-white/72"
            >
              <span className="mr-1">{preset.icon}</span>{preset.name}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {CATEGORY_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => void ensurePresetCategory(preset)}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-left text-xs text-white/72"
            >
              <span className="mr-1">{preset.icon}</span>{preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/45">
            Загружаю разделы…
          </div>
        ) : sections.length === 0 && categories.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/50">
            Пока пусто. Создай первый раздел вручную или скажи AI: “создай раздел Дом”.
          </div>
        ) : (
          <>
            {categoriesBySection.map(({ section, categories: sectionCategories }) => (
              <div
                key={section.id}
                className="rounded-[22px] border border-white/8 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">
                    {section.icon ? `${section.icon} ` : ''}{section.name}
                  </div>
                  <div className="text-xs text-white/35">
                    {sectionCategories.length} катег.
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sectionCategories.length > 0 ? (
                    sectionCategories.map((category) => (
                      <span
                        key={category.id}
                        className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65"
                      >
                        {category.icon ? `${category.icon} ` : ''}{category.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/35">Категорий пока нет</span>
                  )}
                </div>
              </div>
            ))}

            {looseCategories.length > 0 ? (
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
                <div className="font-medium text-white">Без раздела</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {looseCategories.map((category) => (
                    <span
                      key={category.id}
                      className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65"
                    >
                      {category.icon ? `${category.icon} ` : ''}{category.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 p-3">
        <div className="text-sm font-medium text-white">AI-команды для проверки</div>
        <div className="mt-2 space-y-1 text-xs leading-5 text-white/45">
          <div>• создай раздел Дом</div>
          <div>• создай категорию Продукты в разделе Дом</div>
          <div>• запиши все расходы по продуктам в раздел Дом</div>
          <div>• водка 1200 в раздел Настроение</div>
        </div>
      </div>
    </section>
  );
}
