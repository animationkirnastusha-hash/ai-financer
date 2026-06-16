import { create } from 'zustand';

export type SettingsSection = 'voice' | 'fina' | 'ai' | 'currency' | 'data' | 'notifications';

export type JournalFilters = Partial<{
  query: string;
  period: 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
  type: 'all' | 'income' | 'expense' | 'transfer';
  accountId: string;
  categoryId: string;
  tag: string;
}>;

export type AppScreen =
  | 'dashboard'
  | 'accounts'
  | 'analytics'
  | 'journal'
  | 'goals'
  | 'obligations'
  | 'spending-limits'
  | 'companion'
  | 'settings'
  | 'profile'
  | 'store'
  | 'premium'
  | 'business-accountant'
  | 'receipt-scans'
  | 'sections'
  | 'admin'
  | 'referral';

type NavigationState = {
  currentScreen: AppScreen;
  history: AppScreen[];

  isNavigationMenuOpen: boolean;
  hasSystemNotifications: boolean;
  isNotificationsOpen: boolean;
  settingsSection: SettingsSection | null;
  journalFilters: JournalFilters | null;

  navigateTo: (screen: AppScreen) => void;
  openJournal: (filters?: JournalFilters) => void;
  consumeJournalFilters: () => JournalFilters | null;
  openSettingsSection: (section: SettingsSection) => void;
  consumeSettingsSection: () => SettingsSection | null;
  openAIWithCommand: (command?: string) => void;
  goBack: () => void;
  goHome: () => void;

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

  isNavigationMenuOpen: false,
  hasSystemNotifications: true,
  isNotificationsOpen: false,
  settingsSection: null,
  journalFilters: null,

  navigateTo: (screen) => {
    const { currentScreen, history } = get();

    if (screen === 'dashboard') {
      set({
        currentScreen: 'dashboard',
        history: [],
        isNavigationMenuOpen: false,
        isNotificationsOpen: false,
        settingsSection: null,
        journalFilters: null,
      });
      return;
    }

    if (screen === currentScreen) {
      set({
        isNavigationMenuOpen: false,
        isNotificationsOpen: false,
      });
      return;
    }

    set({
      currentScreen: screen,
      history: compactHistory(history, currentScreen, screen),
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      settingsSection: screen === 'settings' ? get().settingsSection : null,
      journalFilters: screen === 'journal' ? get().journalFilters : null,
    });
  },

  openJournal: (filters) => {
    const { currentScreen, history } = get();
    set({
      currentScreen: 'journal',
      history: currentScreen === 'journal' ? history : compactHistory(history, currentScreen, 'journal'),
      journalFilters: filters ?? null,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      settingsSection: null,
    });
  },

  consumeJournalFilters: () => {
    const filters = get().journalFilters;
    if (filters) set({ journalFilters: null });
    return filters;
  },

  openSettingsSection: (section) => {
    const { currentScreen, history } = get();
    set({
      currentScreen: 'settings',
      history: currentScreen === 'settings' ? history : compactHistory(history, currentScreen, 'settings'),
      settingsSection: section,
      journalFilters: null,
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
      detail: { command: trimmedCommand, autoSubmitInitialCommand: Boolean(trimmedCommand) },
    }));

    set({
      settingsSection: null,
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
      set({ currentScreen: 'dashboard', history: [], isNavigationMenuOpen: false, journalFilters: null });
      return;
    }

    set({
      currentScreen: previous,
      history: nextHistory,
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      journalFilters: previous === 'journal' ? get().journalFilters : null,
    });
  },

  goHome: () =>
    set({
      currentScreen: 'dashboard',
      history: [],
      isNavigationMenuOpen: false,
      isNotificationsOpen: false,
      settingsSection: null,
      journalFilters: null,
    }),

  openNavigationMenu: () =>
    set({
      isNavigationMenuOpen: true,
      isNotificationsOpen: false,
    }),
  closeNavigationMenu: () => set({ isNavigationMenuOpen: false }),

  openNotifications: () =>
    set({
      isNotificationsOpen: true,
      isNavigationMenuOpen: false,
    }),
  closeNotifications: () => set({ isNotificationsOpen: false }),
}));
