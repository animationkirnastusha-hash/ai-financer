import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SettingsGearIcon } from '@/shared/ui/AppIcons';

type Props = { onBack: () => void };

function countType(categories: CategoryDto[], type: 'expense' | 'income' | 'both') {
  return categories.filter((category) => (category.type ?? 'expense') === type).length;
}

export default function SectionsPage({ onBack }: Props) {
  const openModal = useAppModalStore((state) => state.openModal);
  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const isLoading = useSectionsStore((state) => state.isLoading);
  const error = useSectionsStore((state) => state.error);
  const loadAll = useSectionsStore((state) => state.loadAll);

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

  return (
    <div className="app-page app-taxonomy-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Категории" left={{ label: 'Назад', onClick: onBack }} right={['notifications', 'home']} />

        <header className="app-card app-card--hero app-taxonomy-hero">
          <div className="app-taxonomy-hero__top app-accounts-hero__top">
            <div>
              <div className="app-eyebrow">Структура расходов</div>
              <h1 className="app-hero-title">Разделы и категории</h1>
              <p className="app-hero-caption">Разделы помогают видеть расходы и доходы в понятном порядке.</p>
            </div>
            <button type="button" onClick={() => openModal({ type: 'taxonomy-tools' })} className="app-icon-button app-icon-button--lg" aria-label="Правила категорий"><SettingsGearIcon className="app-icon-button__svg" /></button>
          </div>

          <div className="app-taxonomy-stats">
            <div><span>{sections.length}</span><small>разделов</small></div>
            <div><span>{categories.length}</span><small>категорий</small></div>
            <div><span>{ungrouped.length}</span><small>без раздела</small></div>
          </div>
        </header>

        <section className="app-card app-taxonomy-actions">
          <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">▣</span>
            <span><b>Новый раздел</b><small>Группа для категорий</small></span>
          </button>
          <button type="button" onClick={() => openModal({ type: 'category-edit' })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>Новая категория</b><small>Расход, доход или оба типа</small></span>
          </button>
        </section>

        <section className="app-card app-taxonomy-rules-grid">
          <div className="app-taxonomy-rule-tile"><small>Расходные</small><b>{countType(categories, 'expense')} категорий</b></div>
          <div className="app-taxonomy-rule-tile"><small>Доходные</small><b>{countType(categories, 'income')} категорий</b></div>
          <div className="app-taxonomy-rule-tile"><small>Универсальные</small><b>{countType(categories, 'both')} категорий</b></div>
          <div className="app-taxonomy-rule-tile"><small>Без раздела</small><b>{ungrouped.length}</b></div>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">Загружаю категории...</div>
        ) : sections.length === 0 && categories.length === 0 ? (
          <EmptyState
            eyebrow="Категории"
            title="Структура пока пустая"
            description="Создай раздел и категории, чтобы диаграммы на главной стали полезнее."
            actionLabel="Создать категорию"
            onAction={() => openModal({ type: 'category-edit' })}
          />
        ) : (
          <section className="app-taxonomy-grid">
            {sections.map((section) => {
              const sectionCategories = categoriesBySection.get(section.id) ?? [];
              const preview = sectionCategories.slice(0, 4);
              return (
                <article key={section.id} className="app-card app-taxonomy-section-card">
                  <div className="app-taxonomy-section-card__head">
                    <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section })} className="app-taxonomy-section-card__title">
                      <span className="app-taxonomy-icon">{section.icon || '◌'}</span>
                      <span><b>{section.name}</b><small>{section.description || 'Раздел для категорий'}</small></span>
                    </button>
                    <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: section.id })} className="app-icon-button" aria-label="Добавить категорию">+</button>
                  </div>

                  <div className="app-taxonomy-preview">
                    {preview.length === 0 ? <span className="app-chip app-chip--muted">Категорий нет</span> : null}
                    {preview.map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                    {sectionCategories.length > preview.length ? <span className="app-chip app-chip--muted">+{sectionCategories.length - preview.length}</span> : null}
                  </div>

                  <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section })} className="app-secondary-button">Открыть</button>
                </article>
              );
            })}

            {ungrouped.length > 0 ? (
              <article className="app-card app-taxonomy-section-card app-taxonomy-section-card--muted">
                <div className="app-taxonomy-section-card__head">
                  <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section: 'ungrouped' })} className="app-taxonomy-section-card__title">
                    <span className="app-taxonomy-icon">⋯</span>
                    <span><b>Без раздела</b><small>Категории, которые ещё нужно разложить</small></span>
                  </button>
                </div>
                <div className="app-taxonomy-preview">
                  {ungrouped.slice(0, 5).map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                </div>
                <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section: 'ungrouped' })} className="app-secondary-button">Разобрать</button>
              </article>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
