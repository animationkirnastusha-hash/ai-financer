import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { CategoryEditSheet } from '@/features/sections/ui/CategoryEditSheet';
import { SectionEditSheet } from '@/features/sections/ui/SectionEditSheet';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';

const examples = [
  'создай раздел подписки',
  'создай категорию кофе в разделе еда',
  'перемести категорию такси в раздел транспорт',
];

type Props = {
  onBack: () => void;
};

export default function SectionsPage({ onBack }: Props) {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const isLoading = useSectionsStore((state) => state.isLoading);
  const isCreating = useSectionsStore((state) => state.isCreating);
  const isMutating = useSectionsStore((state) => state.isMutating);
  const error = useSectionsStore((state) => state.error);
  const loadAll = useSectionsStore((state) => state.loadAll);
  const createSection = useSectionsStore((state) => state.createSection);
  const updateSection = useSectionsStore((state) => state.updateSection);
  const deleteSection = useSectionsStore((state) => state.deleteSection);
  const createCategory = useSectionsStore((state) => state.createCategory);
  const updateCategory = useSectionsStore((state) => state.updateCategory);
  const deleteCategory = useSectionsStore((state) => state.deleteCategory);

  const [sectionSheet, setSectionSheet] = useState<{ mode: 'create' } | { mode: 'edit'; section: SectionDto } | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ mode: 'create'; sectionId?: string | null } | { mode: 'edit'; category: CategoryDto } | null>(null);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const categoriesBySection = useMemo(() => {
    const map = new Map<string, CategoryDto[]>();
    for (const category of categories) {
      const key = category.sectionId ?? 'none';
      map.set(key, [...(map.get(key) ?? []), category]);
    }
    return map;
  }, [categories]);

  const ungrouped = categoriesBySection.get('none') ?? [];

  const openAI = (command: string) => openAIWithCommand(command);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Категории" left={{ label: 'Назад', onClick: onBack }} right={['home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Структура</div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-semibold leading-none tracking-[-0.055em]">Разделы и категории</h1>
              <p className="mt-2 text-sm text-white/46">Создай вручную или скажи голосом.</p>
            </div>
            <button type="button" onClick={() => setCategorySheet({ mode: 'create' })} className="app-primary-button shrink-0">+ Категория</button>
          </div>
        </header>

        <section className="app-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Быстрые действия</div>
              <div className="mt-1 text-xs text-white/42">Одна кнопка или одна голосовая команда.</div>
            </div>
            <button type="button" onClick={() => setSectionSheet({ mode: 'create' })} className="app-secondary-button shrink-0">+ Раздел</button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-no-swipe="true">
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => openAI(example)} className="app-chip shrink-0">{example}</button>
            ))}
          </div>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">Загружаю категории...</div>
        ) : sections.length === 0 && categories.length === 0 ? (
          <EmptyState
            eyebrow="Категории"
            title="Структура пока пустая"
            description="Создай раздел и категории вручную или скажи AI: “создай категорию кофе в разделе еда”."
            actionLabel="Создать категорию"
            onAction={() => setCategorySheet({ mode: 'create' })}
          />
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const sectionCategories = categoriesBySection.get(section.id) ?? [];
              return (
                <section key={section.id} className="app-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSectionSheet({ mode: 'edit', section })} className="min-w-0 text-left">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 text-xl">{section.icon || '◌'}</div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-white">{section.name}</div>
                          <div className="mt-1 line-clamp-1 text-xs text-white/42">{section.description || 'Раздел для категорий'}</div>
                        </div>
                      </div>
                    </button>
                    <button type="button" onClick={() => setCategorySheet({ mode: 'create', sectionId: section.id })} className="app-icon-button shrink-0">+</button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {sectionCategories.length === 0 ? <span className="app-chip app-chip--muted">Категорий нет</span> : null}
                    {sectionCategories.map((category) => (
                      <button key={category.id} type="button" onClick={() => setCategorySheet({ mode: 'edit', category })} className="app-chip">
                        {category.icon ? `${category.icon} ` : ''}{category.name}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}

            {ungrouped.length > 0 ? (
              <section className="app-card p-4">
                <div className="text-sm font-semibold text-white">Без раздела</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ungrouped.map((category) => (
                    <button key={category.id} type="button" onClick={() => setCategorySheet({ mode: 'edit', category })} className="app-chip">
                      {category.icon ? `${category.icon} ` : ''}{category.name}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <SectionEditSheet
        open={!!sectionSheet}
        section={sectionSheet?.mode === 'edit' ? sectionSheet.section : null}
        isSaving={isCreating || isMutating}
        onClose={() => setSectionSheet(null)}
        onSave={async (payload) => {
          if (sectionSheet?.mode === 'edit') await updateSection(sectionSheet.section.id, payload);
          else await createSection(payload);
        }}
        onDelete={async (section) => deleteSection(section.id)}
      />

      <CategoryEditSheet
        open={!!categorySheet}
        category={categorySheet?.mode === 'edit' ? categorySheet.category : null}
        sections={sections}
        isSaving={isCreating || isMutating}
        onClose={() => setCategorySheet(null)}
        onSave={async (payload) => {
          if (categorySheet?.mode === 'edit') await updateCategory(categorySheet.category.id, payload);
          else await createCategory({ ...payload, sectionId: categorySheet?.mode === 'create' ? categorySheet.sectionId ?? payload.sectionId : payload.sectionId });
        }}
        onDelete={async (category) => deleteCategory(category.id)}
      />
    </div>
  );
}
