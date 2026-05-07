import { apiClient } from '@/shared/api/client';

export type SectionDto = {
  id: string;
  userId?: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
  categories?: Array<{
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    type?: string | null;
  }>;
  totals?: {
    income?: number;
    expenses?: number;
    balance?: number;
    transactionCount?: number;
  };
};

export type CategoryDto = {
  id: string;
  userId?: string;
  sectionId?: string | null;
  name: string;
  type?: 'income' | 'expense' | 'both' | string | null;
  icon?: string | null;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
  section?: SectionDto | null;
};

export type CreateSectionPayload = {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
};

export type CreateCategoryPayload = {
  name: string;
  type?: 'income' | 'expense' | 'both';
  sectionId?: string | null;
  icon?: string | null;
  color?: string | null;
};

type SectionsResponse = SectionDto[] | { sections?: SectionDto[] };
type CategoriesResponse = CategoryDto[] | { categories?: CategoryDto[] };
type SectionResponse = SectionDto | { section?: SectionDto };
type CategoryResponse = CategoryDto | { category?: CategoryDto };

function extractSections(payload: SectionsResponse): SectionDto[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.sections) ? payload.sections : [];
}

function extractCategories(payload: CategoriesResponse): CategoryDto[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.categories) ? payload.categories : [];
}

function extractSection(payload: SectionResponse): SectionDto {
  if ('section' in payload && payload.section) return payload.section;
  return payload as SectionDto;
}

function extractCategory(payload: CategoryResponse): CategoryDto {
  if ('category' in payload && payload.category) return payload.category;
  return payload as CategoryDto;
}

export async function fetchSections(): Promise<SectionDto[]> {
  const payload = await apiClient.get<SectionsResponse>('/sections');
  return extractSections(payload);
}

export async function createSection(payload: CreateSectionPayload): Promise<SectionDto> {
  const response = await apiClient.post<SectionResponse>('/sections', payload);
  return extractSection(response);
}

export async function updateSection(
  sectionId: string,
  payload: Partial<CreateSectionPayload>,
): Promise<SectionDto> {
  const response = await apiClient.patch<SectionResponse>(`/sections/${sectionId}`, payload);
  return extractSection(response);
}

export async function deleteSection(sectionId: string): Promise<void> {
  await apiClient.delete(`/sections/${sectionId}`);
}

export async function fetchCategories(): Promise<CategoryDto[]> {
  const payload = await apiClient.get<CategoriesResponse>('/categories');
  return extractCategories(payload);
}

export async function createCategory(payload: CreateCategoryPayload): Promise<CategoryDto> {
  const response = await apiClient.post<CategoryResponse>('/categories', payload);
  return extractCategory(response);
}
