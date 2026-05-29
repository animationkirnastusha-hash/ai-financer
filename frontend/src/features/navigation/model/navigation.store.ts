import { create } from 'zustand';

export type AppScreen =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'analytics'
  | 'goals'
  | 'companion'
  | 'settings'
  | 'premium'
  | 'business-accountant'
  | 'sections'
  | 'taxonomy-settings'
  | 'ai-core'
  | 'admin'
  | 'referral';

type NavigationState = {
  currentScreen: AppScreen;
  history: AppScreen[];

  isAIMenuOpen: boolean;
  isGlobalCommandListOpen: boolean;
  isNavigationMenuOpen: boolean;
  hasSystemNotifications: boolean;
  isNotificationsOpen: boolean;
  initialAICommand: string | null;

  navigateTo: (screen: AppScreen) => void;
  openAIWithCommand: (command?: string) => void;
  consumeInitialAICommand: () => string | null;
  goBack: () => void;
  goHome: () => void;

  openAIMenu: () => void;
  closeAIMenu: () => void;

  openGlobalCommandList: () => void;
  closeGlobalCommandList: () => void;

  openNavigationMenu: () => void;
  closeNavigationMenu: () => void;

  openNotifications: () => void;
  closeNotifications: () => void;
};

function compactHistory(history: AppScreen[], currentScreen: AppScreen, nextScreen: AppScreen) {
  return [...history.filter((screen) => screen !== nextScreen), currentScreen].slice(-12);
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentScreen: 'dashboard',
  history: [],

  isAIMenuOpen: false,
  isGlobalCommandListOpen: false,
  isNavigationMenuOpen: false,
  hasSystemNotifications: true,
  isNotificationsOpen: false,
  initialAICommand: null,

  navigateTo: (screen) => {
    const { currentScreen, history } = get();

    if (screen === currentScreen) {
      set({
        isAIMenuOpen: false,
        isGlobalCommandListOpen: false,
        isNavigationMenuOpen: false,
        isNotificationsOpen: false,
      });
      return;
    }

    set({
      currentScreen: screen,
      history: compactHistory(history, currentScreen, screen),
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      initialAICommand: screen === 'ai-core' ? get().initialAICommand : null,
    });
  },

  openAIWithCommand: (command) => {
    const { currentScreen, history } = get();
    const trimmedCommand = command?.trim() || null;

    set({
      currentScreen: 'ai-core',
      history: currentScreen === 'ai-core' ? history : compactHistory(history, currentScreen, 'ai-core'),
      initialAICommand: trimmedCommand,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
    });
  },

  consumeInitialAICommand: () => {
    const command = get().initialAICommand;
    if (command) set({ initialAICommand: null });
    return command;
  },

  goBack: () => {
    const { history, currentScreen } = get();
    const nextHistory = [...history];
    let previous = nextHistory.pop();

    while (previous === currentScreen) previous = nextHistory.pop();

    if (!previous) {
      set({ currentScreen: 'dashboard', history: [], isNavigationMenuOpen: false });
      return;
    }

    set({
      currentScreen: previous,
      history: nextHistory,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      initialAICommand: null,
    });
  },

  goHome: () =>
    set({
      currentScreen: 'dashboard',
      history: [],
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      initialAICommand: null,
    }),

  openAIMenu: () => set({ isAIMenuOpen: true, isNotificationsOpen: false, isNavigationMenuOpen: false }),
  closeAIMenu: () => set({ isAIMenuOpen: false }),

  openGlobalCommandList: () =>
    set({
      isGlobalCommandListOpen: true,
      isAIMenuOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
    }),
  closeGlobalCommandList: () => set({ isGlobalCommandListOpen: false }),

  openNavigationMenu: () =>
    set({
      isNavigationMenuOpen: true,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNotificationsOpen: false,
    }),
  closeNavigationMenu: () => set({ isNavigationMenuOpen: false }),

  openNotifications: () =>
    set({
      isNotificationsOpen: true,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
    }),
  closeNotifications: () => set({ isNotificationsOpen: false }),
}));
