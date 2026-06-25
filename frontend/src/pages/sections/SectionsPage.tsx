import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SettingsGearIcon } from '@/shared/ui/AppIcons';
import { useI18n } from '@/shared/lib/i18n';


type Props = { onBack: () => void };

type CategoryKind = 'expense' | 'income' | 'both';

function countType(categories: CategoryDto[], type: CategoryKind) {
  return categories.filter((category) => (category.type ?? 'expense') === type).length;
}

function supportsType(category: CategoryDto, type: CategoryKind) {
  return (category.type ?? 'expense') === type;
}

function typeLabel(category: CategoryDto, t: (key: string, params?: Record<string, string | number>) => string) {
  const type = category.type === 'income' || category.type === 'both' ? category.type : 'expense';
  if (type === 'income') return t('sections.category.type.income');
  if (type === 'both') return t('sections.category.type.both');
  return t('sections.category.type.expense');
}

export default function SectionsPage({ onBack }: Props) {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const categories = useSectionsStore((state) => state.categories);
  const isLoading = useSectionsStore((state) => state.isLoading);
  const error = useSectionsStore((state) => state.error);
  const loadAll = useSectionsStore((state) => state.loadAll);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((left, right) => {
      const leftType = left.type === 'income' ? 1 : left.type === 'both' ? 2 : 0;
      const rightType = right.type === 'income' ? 1 : right.type === 'both' ? 2 : 0;
      return leftType - rightType || left.name.localeCompare(right.name, 'ru');
    });
  }, [categories]);

  const expenseCategories = useMemo(() => sortedCategories.filter((category) => supportsType(category, 'expense')), [sortedCategories]);
  const incomeCategories = useMemo(() => sortedCategories.filter((category) => supportsType(category, 'income')), [sortedCategories]);
  const universalCategories = useMemo(() => sortedCategories.filter((category) => supportsType(category, 'both')), [sortedCategories]);

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
            <button type="button" onClick={() => openModal({ type: 'taxonomy-tools' })} className="app-icon-button app-icon-button--lg" aria-label={t('sections.manage.open')}><SettingsGearIcon className="app-icon-button__svg" /></button>
          </div>

          <div className="app-taxonomy-stats app-taxonomy-stats--category-only">
            <div><span>{categories.length}</span><small>{t('sections.stats.categories')}</small></div>
            <div><span>{countType(categories, 'expense')}</span><small>{t('sections.types.expense')}</small></div>
            <div><span>{countType(categories, 'income')}</span><small>{t('sections.types.income')}</small></div>
          </div>
        </header>

        <FinaCommandBar
          titleKey="sections.command.title"
          captionKey="sections.command.caption"
          placeholderKey="sections.command.placeholder"
          suggestions={[
            { key: 'sections.command.category', command: 'создай категорию Такси' },
            { key: 'sections.command.merge', command: 'объедини кафе и кофейни в категорию Кафе и рестораны' },
            { key: 'sections.command.rename', command: 'переименуй категорию еда в продукты' },
          ]}
        />

        <section className="app-card app-taxonomy-actions">
          <button type="button" onClick={() => openModal({ type: 'category-edit' })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>{t('sections.action.category.title')}</b><small>{t('sections.action.category.caption')}</small></span>
          </button>
        </section>

        <section className="app-card app-taxonomy-summary-grid">
          <div className="app-taxonomy-summary-tile"><small>{t('sections.types.expense')}</small><b>{t('sections.types.count', { count: expenseCategories.length })}</b></div>
          <div className="app-taxonomy-summary-tile"><small>{t('sections.types.income')}</small><b>{t('sections.types.count', { count: incomeCategories.length })}</b></div>
          <div className="app-taxonomy-summary-tile"><small>{t('sections.types.both')}</small><b>{t('sections.types.count', { count: universalCategories.length })}</b></div>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">{t('sections.loading')}</div>
        ) : categories.length === 0 ? (
          <EmptyState
            eyebrow={t('screen.sections')}
            title={t('sections.empty.title')}
            description={t('sections.empty.caption')}
            actionLabel={t('sections.empty.action')}
            onAction={() => openModal({ type: 'category-edit' })}
          />
        ) : (
          <section className="app-taxonomy-grid app-taxonomy-grid--categories">
            {sortedCategories.map((category) => (
              <article key={category.id} className="app-card app-taxonomy-category-card">
                <button type="button" className="app-taxonomy-category-card__main" onClick={() => openModal({ type: 'category-edit', category })}>
                  <span className="app-taxonomy-icon app-taxonomy-icon--category" style={category.color ? { background: category.color } : undefined}>{category.icon || '◌'}</span>
                  <span>
                    <b>{category.name}</b>
                    <small>{typeLabel(category, t)}</small>
                  </span>
                </button>
                <button type="button" onClick={() => openModal({ type: 'category-edit', category })} className="app-secondary-button">{t('sections.category.editTitle')}</button>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
