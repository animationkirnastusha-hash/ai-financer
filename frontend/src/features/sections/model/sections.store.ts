import { create } from 'zustand';
import {
  createCategory,
  createSection,
  deleteSection,
  fetchCategories,
  fetchSections,
  updateSection,
  type CategoryDto,
  type CreateCategoryPayload,
  type CreateSectionPayload,
  type SectionDto,
} from '@/features/sections/api/sections.api';

type SectionsState = {
  sections: SectionDto[];
  categories: CategoryDto[];
  selectedSectionId: string | null;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  loadAll: (force?: boolean) => Promise<void>;
  createSection: (payload: CreateSectionPayload) => Promise<SectionDto>;
  updateSection: (id: string, payload: Partial<CreateSectionPayload>) => Promise<SectionDto>;
  deleteSection: (id: string) => Promise<void>;
  createCategory: (payload: CreateCategoryPayload) => Promise<CategoryDto>;
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
      set({
        sections: [section, ...get().sections.filter((item) => item.id !== section.id)],
        selectedSectionId: section.id,
        isCreating: false,
      });
      return section;
    } catch (error) {
      console.error(error);
      set({ isCreating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateSection: async (id, payload) => {
    const previous = get().sections;
    set({ sections: previous.map((item) => (item.id === id ? { ...item, ...payload } : item)) });

    try {
      const section = await updateSection(id, payload);
      set({ sections: get().sections.map((item) => (item.id === id ? section : item)) });
      return section;
    } catch (error) {
      console.error(error);
      set({ sections: previous, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteSection: async (id) => {
    const previous = get().sections;
    set({ sections: previous.filter((item) => item.id !== id) });

    try {
      await deleteSection(id);
    } catch (error) {
      console.error(error);
      set({ sections: previous, error: getErrorMessage(error) });
      throw error;
    }
  },

  createCategory: async (payload) => {
    set({ isCreating: true, error: null });

    try {
      const category = await createCategory(payload);
      set({ categories: [category, ...get().categories], isCreating: false });
      await get().loadAll(true);
      return category;
    } catch (error) {
      console.error(error);
      set({ isCreating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  selectSection: (id) => set({ selectedSectionId: id }),
}));
