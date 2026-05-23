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

type Props = { onBack: () => void };

type SectionModal = SectionDto | 'ungrouped' | null;

function typeLabel(type?: string | null) {
  if (type === 'income') return 'Доход';
  if (type === 'both') return 'Оба';
  return 'Расход';
}

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
  const [sectionModal, setSectionModal] = useState<SectionModal>(null);

  useEffect(() => { void loadAll(); }, [loadAll]);

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

  const modalCategories = sectionModal === 'ungrouped'
    ? ungrouped
    : sectionModal
      ? categoriesBySection.get(sectionModal.id) ?? []
      : [];

  return (
    <div className="app-page app-taxonomy-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Категории" left={{ label: 'Назад', onClick: onBack }} right={['home']} />

        <header className="app-card app-card--hero app-taxonomy-hero">
          <div className="app-eyebrow">Структура расходов</div>
          <h1 className="app-hero-title">Разделы без хаоса</h1>
          <p className="app-hero-caption">На странице — только обзор. Создание, редактирование и длинные списки открываются в модалках.</p>

          <div className="app-taxonomy-stats">
            <div><span>{sections.length}</span><small>разделов</small></div>
            <div><span>{categories.length}</span><small>категорий</small></div>
            <div><span>{ungrouped.length}</span><small>без раздела</small></div>
          </div>
        </header>

        <section className="app-card app-taxonomy-actions">
          <button type="button" onClick={() => setSectionSheet({ mode: 'create' })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">▣</span>
            <span><b>Новый раздел</b><small>Например, Еда или Подписки</small></span>
          </button>
          <button type="button" onClick={() => setCategorySheet({ mode: 'create' })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>Новая категория</b><small>Привязать к разделу</small></span>
          </button>
        </section>

        <section className="app-card app-taxonomy-examples">
          <div className="app-section-title">Голосовые примеры</div>
          <div className="mt-3 grid gap-2">
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => openAI(example)} className="app-list-button">
                <span>{example}</span>
                <small>Фина подготовит действие и покажет подтверждение</small>
              </button>
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
            description="Создай раздел и категории вручную или скажи Фине: “создай категорию кофе в разделе еда”."
            actionLabel="Создать категорию"
            onAction={() => setCategorySheet({ mode: 'create' })}
          />
        ) : (
          <section className="app-taxonomy-grid">
            {sections.map((section) => {
              const sectionCategories = categoriesBySection.get(section.id) ?? [];
              const preview = sectionCategories.slice(0, 4);
              return (
                <article key={section.id} className="app-card app-taxonomy-section-card">
                  <div className="app-taxonomy-section-card__head">
                    <button type="button" onClick={() => setSectionSheet({ mode: 'edit', section })} className="app-taxonomy-section-card__title">
                      <span className="app-taxonomy-icon">{section.icon || '◌'}</span>
                      <span><b>{section.name}</b><small>{section.description || 'Раздел для категорий'}</small></span>
                    </button>
                    <button type="button" onClick={() => setCategorySheet({ mode: 'create', sectionId: section.id })} className="app-icon-button">+</button>
                  </div>

                  <div className="app-taxonomy-preview">
                    {preview.length === 0 ? <span className="app-chip app-chip--muted">Категорий нет</span> : null}
                    {preview.map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                    {sectionCategories.length > preview.length ? <span className="app-chip app-chip--muted">+{sectionCategories.length - preview.length}</span> : null}
                  </div>

                  <button type="button" onClick={() => setSectionModal(section)} className="app-secondary-button w-full">Открыть раздел</button>
                </article>
              );
            })}

            {ungrouped.length > 0 ? (
              <article className="app-card app-taxonomy-section-card app-taxonomy-section-card--muted">
                <div className="app-taxonomy-section-card__head">
                  <button type="button" onClick={() => setSectionModal('ungrouped')} className="app-taxonomy-section-card__title">
                    <span className="app-taxonomy-icon">⋯</span>
                    <span><b>Без раздела</b><small>Категории, которые ещё нужно разложить</small></span>
                  </button>
                </div>
                <div className="app-taxonomy-preview">
                  {ungrouped.slice(0, 5).map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                </div>
                <button type="button" onClick={() => setSectionModal('ungrouped')} className="app-secondary-button w-full">Разобрать категории</button>
              </article>
            ) : null}
          </section>
        )}
      </div>

      {sectionModal ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => setSectionModal(null)}>
          <div className="app-modal-sheet app-taxonomy-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div className="app-taxonomy-modal__head">
                <div>
                  <div className="app-eyebrow">Категории</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">
                    {sectionModal === 'ungrouped' ? 'Без раздела' : sectionModal.name}
                  </h2>
                </div>
                {sectionModal !== 'ungrouped' ? <button type="button" onClick={() => setSectionSheet({ mode: 'edit', section: sectionModal })} className="app-secondary-button">Править</button> : null}
              </div>

              <div className="grid gap-2">
                {modalCategories.length === 0 ? <div className="app-empty-inline">Категорий пока нет.</div> : null}
                {modalCategories.map((category) => (
                  <button key={category.id} type="button" onClick={() => setCategorySheet({ mode: 'edit', category })} className="app-list-button">
                    <span>{category.icon ? `${category.icon} ` : ''}{category.name}</span>
                    <small>{typeLabel(category.type)} · нажми, чтобы изменить</small>
                  </button>
                ))}
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSectionModal(null)} className="app-secondary-button">Закрыть</button>
                <button type="button" onClick={() => setCategorySheet({ mode: 'create', sectionId: sectionModal === 'ungrouped' ? null : sectionModal.id })} className="app-primary-button">+ Категория</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

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
