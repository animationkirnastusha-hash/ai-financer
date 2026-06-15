import { create } from 'zustand';

export const PRODUCT_TOUR_STORAGE_KEY = 'ai-financer-product-tour-seen:v1';
export const PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY = 'ai-financer-product-tour-eligible:v1';

type ProductTourState = {
  isOpen: boolean;
  hasSeenTour: boolean;
  activeStepIndex: number;
  open: () => void;
  close: () => void;
  complete: () => void;
  enableForNewUser: () => void;
  disableForCurrentUser: () => void;
  reset: () => void;
  setActiveStepIndex: (index: number) => void;
};

function isTourEligible() {
  return localStorage.getItem(PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY) === 'true';
}

function readSeenTour() {
  if (localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === 'true') return true;
  return !isTourEligible();
}

function saveSeenTour() {
  localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'true');
  localStorage.removeItem(PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY);
}

function allowTourForNewUser() {
  localStorage.setItem(PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY, 'true');
  localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
}

function disableTourForCurrentUser() {
  localStorage.removeItem(PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY);
  localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'true');
}

export const useProductTourStore = create<ProductTourState>((set) => {
  const hasSeenTour = readSeenTour();

  return {
    isOpen: false,
    hasSeenTour,
    activeStepIndex: 0,

    open: () => set((state) => (state.hasSeenTour || !isTourEligible() ? state : { isOpen: true, activeStepIndex: 0 })),

    close: () => {
      saveSeenTour();
      set({ isOpen: false, hasSeenTour: true });
    },

    complete: () => {
      saveSeenTour();
      set({ isOpen: false, hasSeenTour: true, activeStepIndex: 0 });
    },

    enableForNewUser: () => {
      allowTourForNewUser();
      set({ isOpen: false, hasSeenTour: false, activeStepIndex: 0 });
    },

    disableForCurrentUser: () => {
      disableTourForCurrentUser();
      set({ isOpen: false, hasSeenTour: true, activeStepIndex: 0 });
    },

    reset: () => {
      localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
      localStorage.removeItem(PRODUCT_TOUR_ELIGIBLE_STORAGE_KEY);
      set({ isOpen: false, hasSeenTour: true, activeStepIndex: 0 });
    },

    setActiveStepIndex: (activeStepIndex) => set({ activeStepIndex }),
  };
});
