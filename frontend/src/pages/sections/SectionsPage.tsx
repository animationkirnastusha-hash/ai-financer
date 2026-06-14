import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SettingsGearIcon } from '@/shared/ui/AppIcons';
import { useI18n } from '@/shared/lib/i18n';

type Props = { onBack: () => void };

function countType(categories: CategoryDto[], type: 'expense' | 'income' | 'both') {
  return categories.filter((category) => (category.type ?? 'expense') === type).length;
}

function mergeVisibleSections(sections: SectionDto[], categories: CategoryDto[]) {
  const map = new Map<string, SectionDto>();
  for (const section of sections) map.set(section.id, section);

  for (const category of categories) {
    if (!category.sectionId || !category.section || map.has(category.sectionId)) continue;
    map.set(category.sectionId, category.section);
  }

  return [...map.values()].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aDate - bDate;
  });
}

export default function SectionsPage({ onBack }: Props) {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const isLoading = useSectionsStore((state) => state.isLoading);
  const error = useSectionsStore((state) => state.error);
  const loadAll = useSectionsStore((state) => state.loadAll);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const visibleSections = useMemo(() => mergeVisibleSections(sections, categories), [sections, categories]);

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
        <ScreenTopBar title={t('screen.sections')} left={{ label: t('common.back'), onClick: onBack }} right={['notifications', 'home']} />

        <header className="app-card app-card--hero app-taxonomy-hero">
          <div className="app-taxonomy-hero__top app-accounts-hero__top">
            <div>
              <div className="app-eyebrow">{t('sections.hero.eyebrow')}</div>
              <h1 className="app-hero-title">{t('sections.hero.title')}</h1>
              <p className="app-hero-caption">{t('sections.hero.caption')}</p>
            </div>
            <button type="button" onClick={() => openModal({ type: 'taxonomy-tools' })} className="app-icon-button app-icon-button--lg" aria-label={t('sections.rules.open')}><SettingsGearIcon className="app-icon-button__svg" /></button>
          </div>

          <div className="app-taxonomy-stats">
            <div><span>{visibleSections.length}</span><small>{t('sections.stats.sections')}</small></div>
            <div><span>{categories.length}</span><small>{t('sections.stats.categories')}</small></div>
            <div><span>{ungrouped.length}</span><small>{t('sections.stats.ungrouped')}</small></div>
          </div>
        </header>

        <FinaCommandBar
          titleKey="sections.command.title"
          captionKey="sections.command.caption"
          placeholderKey="sections.command.placeholder"
          suggestions={[
            { key: 'sections.command.rule', command: 'создай правило все Яндекс Такси транспорт' },
            { key: 'sections.command.merge', command: 'объедини кафе и кофейни' },
            { key: 'sections.command.rename', command: 'переименуй категорию еда в продукты' },
          ]}
        />

        <section className="app-card app-taxonomy-actions">
          <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">▣</span>
            <span><b>{t('sections.action.section.title')}</b><small>{t('sections.action.section.caption')}</small></span>
          </button>
          <button type="button" onClick={() => openModal({ type: 'category-edit' })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>{t('sections.action.category.title')}</b><small>{t('sections.action.category.caption')}</small></span>
          </button>
        </section>

        <section className="app-card app-taxonomy-rules-grid">
          <div className="app-taxonomy-rule-tile"><small>{t('sections.types.expense')}</small><b>{t('sections.types.count', { count: countType(categories, 'expense') })}</b></div>
          <div className="app-taxonomy-rule-tile"><small>{t('sections.types.income')}</small><b>{t('sections.types.count', { count: countType(categories, 'income') })}</b></div>
          <div className="app-taxonomy-rule-tile"><small>{t('sections.types.both')}</small><b>{t('sections.types.count', { count: countType(categories, 'both') })}</b></div>
          <div className="app-taxonomy-rule-tile"><small>{t('sections.types.ungrouped')}</small><b>{ungrouped.length}</b></div>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">{t('sections.loading')}</div>
        ) : visibleSections.length === 0 && categories.length === 0 ? (
          <EmptyState
            eyebrow={t('screen.sections')}
            title={t('sections.empty.title')}
            description={t('sections.empty.caption')}
            actionLabel={t('sections.empty.action')}
            onAction={() => openModal({ type: 'category-edit' })}
          />
        ) : (
          <section className="app-taxonomy-grid">
            {visibleSections.map((section) => {
              const sectionCategories = categoriesBySection.get(section.id) ?? [];
              const preview = sectionCategories.slice(0, 4);
              return (
                <article key={section.id} className="app-card app-taxonomy-section-card">
                  <div className="app-taxonomy-section-card__head">
                    <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section })} className="app-taxonomy-section-card__title">
                      <span className="app-taxonomy-icon">{section.icon || '◌'}</span>
                      <span><b>{section.name}</b><small>{section.description || t('sections.section.defaultCaption')}</small></span>
                    </button>
                    <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: section.id })} className="app-icon-button" aria-label={t('sections.section.addCategory')}>+</button>
                  </div>

                  <div className="app-taxonomy-preview">
                    {preview.length === 0 ? <span className="app-chip app-chip--muted">{t('sections.section.noCategories')}</span> : null}
                    {preview.map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                    {sectionCategories.length > preview.length ? <span className="app-chip app-chip--muted">+{sectionCategories.length - preview.length}</span> : null}
                  </div>

                  <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section })} className="app-secondary-button">{t('sections.section.open')}</button>
                </article>
              );
            })}

            {ungrouped.length > 0 ? (
              <article className="app-card app-taxonomy-section-card app-taxonomy-section-card--muted">
                <div className="app-taxonomy-section-card__head">
                  <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section: 'ungrouped' })} className="app-taxonomy-section-card__title">
                    <span className="app-taxonomy-icon">⋯</span>
                    <span><b>{t('sections.ungrouped.title')}</b><small>{t('sections.ungrouped.caption')}</small></span>
                  </button>
                </div>
                <div className="app-taxonomy-preview">
                  {ungrouped.slice(0, 5).map((category) => <span key={category.id} className="app-chip">{category.icon ? `${category.icon} ` : ''}{category.name}</span>)}
                </div>
                <button type="button" onClick={() => openModal({ type: 'taxonomy-section', section: 'ungrouped' })} className="app-secondary-button">{t('sections.ungrouped.action')}</button>
              </article>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
