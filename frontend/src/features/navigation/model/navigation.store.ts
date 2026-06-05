import { create } from 'zustand';

export type SettingsSection = 'voice' | 'fina' | 'ai' | 'currency' | 'data' | 'notifications';

export type AppScreen =
  | 'dashboard'
  | 'accounts'
  | 'analytics'
  | 'goals'
  | 'obligations'
  | 'companion'
  | 'settings'
  | 'store'
  | 'premium'
  | 'business-accountant'
  | 'sections'
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
  settingsSection: SettingsSection | null;

  navigateTo: (screen: AppScreen) => void;
  openSettingsSection: (section: SettingsSection) => void;
  consumeSettingsSection: () => SettingsSection | null;
  openAIWithCommand: (command?: string) => void;
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
  settingsSection: null,

  navigateTo: (screen) => {
    const targetScreen = screen;
    const { currentScreen, history } = get();

    if (targetScreen === currentScreen) {
      set({
        isAIMenuOpen: false,
        isGlobalCommandListOpen: false,
        isNavigationMenuOpen: false,
        isNotificationsOpen: false,
      });
      return;
    }

    set({
      currentScreen: targetScreen,
      history: compactHistory(history, currentScreen, targetScreen),
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      settingsSection: targetScreen === 'settings' ? get().settingsSection : null,
    });
  },

  openSettingsSection: (section) => {
    const { currentScreen, history } = get();
    set({
      currentScreen: 'settings',
      history: currentScreen === 'settings' ? history : compactHistory(history, currentScreen, 'settings'),
      settingsSection: section,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
    });
  },

  consumeSettingsSection: () => {
    const section = get().settingsSection;
    if (section) set({ settingsSection: null });
    return section;
  },

  openAIWithCommand: (command) => {
    const trimmedCommand = command?.trim() || null;

    window.dispatchEvent(new CustomEvent('ai-financer:open-text-chat', {
      detail: { command: trimmedCommand },
    }));

    set({
      settingsSection: null,
      isAIMenuOpen: false,
      isGlobalCommandListOpen: false,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
    });
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
      settingsSection: null,
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
