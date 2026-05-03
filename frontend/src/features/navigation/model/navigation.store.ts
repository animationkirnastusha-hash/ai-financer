import { create } from 'zustand';

export type AppScreen =
  | 'ai-core'
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'settings';

type NavigationState = {
  currentScreen: AppScreen;
  history: AppScreen[];

  isAIMenuOpen: boolean;
  isGlobalCommandListOpen: boolean;

  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;

  openAIMenu: () => void;
  closeAIMenu: () => void;

  openGlobalCommandList: () => void;
  closeGlobalCommandList: () => void;
};

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentScreen: 'ai-core',
  history: [],

  isAIMenuOpen: false,
  isGlobalCommandListOpen: false,

  navigateTo: (screen) => {
    const { currentScreen, history } = get();

    if (screen === currentScreen) {
      set({ isAIMenuOpen: false, isGlobalCommandListOpen: false });
      return;
    }

    set({
      currentScreen: screen,
      history: [...history, currentScreen],
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
    });
  },

  goBack: () => {
    const { history, currentScreen } = get();
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    const nextHistory = history.slice(0, -1);

    set({
      currentScreen: previous ?? currentScreen,
      history: nextHistory,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
    });
  },

  openAIMenu: () => set({ isAIMenuOpen: true }),
  closeAIMenu: () => set({ isAIMenuOpen: false }),

  openGlobalCommandList: () =>
    set({ isGlobalCommandListOpen: true, isAIMenuOpen: false }),
  closeGlobalCommandList: () => set({ isGlobalCommandListOpen: false }),
}));