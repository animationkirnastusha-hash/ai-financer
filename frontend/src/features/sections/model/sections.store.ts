import { create } from 'zustand';
import {
  createCategory,
  createSection,
  deleteCategory,
  deleteSection,
  fetchCategories,
  fetchSections,
  updateCategory,
  updateSection,
  type CategoryDto,
  type CreateCategoryPayload,
  type CreateSectionPayload,
  type SectionDto,
  type UpdateCategoryPayload,
  type UpdateSectionPayload,
} from '@/features/sections/api/sections.api';

type SectionsState = {
  sections: SectionDto[];
  categories: CategoryDto[];
  selectedSectionId: string | null;
  isLoading: boolean;
  isCreating: boolean;
  isMutating: boolean;
  error: string | null;

  loadAll: (force?: boolean) => Promise<void>;
  createSection: (payload: CreateSectionPayload) => Promise<SectionDto>;
  updateSection: (id: string, payload: UpdateSectionPayload) => Promise<SectionDto>;
  deleteSection: (id: string) => Promise<void>;
  createCategory: (payload: CreateCategoryPayload) => Promise<CategoryDto>;
  updateCategory: (id: string, payload: UpdateCategoryPayload) => Promise<CategoryDto>;
  deleteCategory: (id: string) => Promise<void>;
  selectSection: (id: string | null) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить действие';
}

export const useSectionsStore = create<SectionsState>((set, get) => ({
  sections: [],
  categories: [],
  selectedSectionId: null,
  isLoading: false,
  isCreating: false,
  isMutating: false,
  error: null,

  loadAll: async (force = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true, error: null });

    try {
      const [sections, categories] = await Promise.all([
        fetchSections(),
        fetchCategories().catch(() => []),
      ]);

      set({ sections, categories, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  createSection: async (payload) => {
    set({ isCreating: true, error: null });

    try {
      const section = await createSection(payload);
      await get().loadAll(true);
      set({ selectedSectionId: section.id, isCreating: false });
      return section;
    } catch (error) {
      console.error(error);
      set({ isCreating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateSection: async (id, payload) => {
    set({ isMutating: true, error: null });
    const previous = get().sections;
    set({ sections: previous.map((item) => (item.id === id ? { ...item, ...payload } : item)) });

    try {
      const section = await updateSection(id, payload);
      await get().loadAll(true);
      set({ isMutating: false });
      return section;
    } catch (error) {
      console.error(error);
      set({ sections: previous, isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteSection: async (id) => {
    set({ isMutating: true, error: null });
    const previous = get().sections;
    set({ sections: previous.filter((item) => item.id !== id) });

    try {
      await deleteSection(id);
      await get().loadAll(true);
      set({ isMutating: false, selectedSectionId: get().selectedSectionId === id ? null : get().selectedSectionId });
    } catch (error) {
      console.error(error);
      set({ sections: previous, isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  createCategory: async (payload) => {
    set({ isCreating: true, error: null });

    try {
      const category = await createCategory(payload);
      await get().loadAll(true);
      set({ isCreating: false });
      return category;
    } catch (error) {
      console.error(error);
      set({ isCreating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateCategory: async (id, payload) => {
    set({ isMutating: true, error: null });
    const previous = get().categories;
    set({ categories: previous.map((item) => (item.id === id ? { ...item, ...payload } : item)) });

    try {
      const category = await updateCategory(id, payload);
      await get().loadAll(true);
      set({ isMutating: false });
      return category;
    } catch (error) {
      console.error(error);
      set({ categories: previous, isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteCategory: async (id) => {
    set({ isMutating: true, error: null });
    const previous = get().categories;
    set({ categories: previous.filter((item) => item.id !== id) });

    try {
      await deleteCategory(id);
      await get().loadAll(true);
      set({ isMutating: false });
    } catch (error) {
      console.error(error);
      set({ categories: previous, isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  selectSection: (id) => set({ selectedSectionId: id }),
}));
