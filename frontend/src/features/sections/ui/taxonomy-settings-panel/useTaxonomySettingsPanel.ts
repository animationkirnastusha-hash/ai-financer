import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { CATEGORY_PRESETS, SECTION_PRESETS } from './taxonomySettingsPanel.presets';
import type {
  CategoryPreset,
  SectionPreset,
  TaxonomyCategoryType,
  TranslateFn,
} from './taxonomySettingsPanel.types';

export function useTaxonomySettingsPanel(t: TranslateFn) {
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
  const [categoryType, setCategoryType] = useState<TaxonomyCategoryType>('expense');
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

  function getSectionPresetName(preset: SectionPreset) {
    return t(preset.nameKey);
  }

  function getCategoryPresetName(preset: CategoryPreset) {
    return t(preset.nameKey);
  }

  async function ensurePresetSection(preset: SectionPreset) {
    const name = getSectionPresetName(preset);
    const exists = sections.some((section) => section.name.toLowerCase() === name.toLowerCase());
    if (exists) return;

    await createSection({
      name,
      icon: preset.icon,
      description: t(preset.descriptionKey),
    });
  }

  async function ensurePresetCategory(preset: CategoryPreset) {
    const name = getCategoryPresetName(preset);
    const exists = categories.some((category) => category.name.toLowerCase() === name.toLowerCase());
    if (exists) return;

    const sectionName = t(preset.sectionNameKey);
    let section = sections.find((item) => item.name.toLowerCase() === sectionName.toLowerCase());

    if (!section) {
      section = await createSection({
        name: sectionName,
        icon: SECTION_PRESETS.find((item) => item.nameKey === preset.sectionNameKey)?.icon ?? null,
      });
    }

    await createCategory({
      name,
      icon: preset.icon,
      type: preset.type ?? 'expense',
      sectionId: section.id,
    });
  }

  return {
    sections,
    categories,
    isLoading,
    isCreating,
    error,
    sectionName,
    setSectionName,
    sectionIcon,
    setSectionIcon,
    categoryName,
    setCategoryName,
    categoryIcon,
    setCategoryIcon,
    categoryType,
    setCategoryType,
    selectedSectionId,
    setSelectedSectionId,
    categoriesBySection,
    looseCategories,
    sectionPresets: SECTION_PRESETS,
    categoryPresets: CATEGORY_PRESETS,
    handleCreateSection,
    handleCreateCategory,
    ensurePresetSection,
    ensurePresetCategory,
  };
}
