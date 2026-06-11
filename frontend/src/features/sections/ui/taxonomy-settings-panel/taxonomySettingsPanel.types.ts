import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';

export type TaxonomyCategoryType = 'expense' | 'income' | 'both';

export type SectionPreset = {
  nameKey: string;
  icon: string;
  descriptionKey: string;
};

export type CategoryPreset = {
  nameKey: string;
  icon: string;
  sectionNameKey: string;
  type?: TaxonomyCategoryType;
};

export type CategoriesBySection = {
  section: SectionDto;
  categories: CategoryDto[];
};

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
