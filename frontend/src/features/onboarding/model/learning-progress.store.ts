import { create } from 'zustand';

export type LearningProgressStep = 'firstExpense' | 'firstQuestion' | 'firstGoal' | 'firstLimit';

type LearningProgressState = {
  completed: Record<LearningProgressStep, boolean>;
  isDismissed: boolean;
  mark: (step: LearningProgressStep) => void;
  dismiss: () => void;
  reset: () => void;
};

const STORAGE_KEY = 'ai-financer-learning-progress:v1';

const defaultCompleted: Record<LearningProgressStep, boolean> = {
  firstExpense: false,
  firstQuestion: false,
  firstGoal: false,
  firstLimit: false,
};

function readState(): Pick<LearningProgressState, 'completed' | 'isDismissed'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: defaultCompleted, isDismissed: false };
    const parsed = JSON.parse(raw) as Partial<Pick<LearningProgressState, 'completed' | 'isDismissed'>>;
    return {
      completed: { ...defaultCompleted, ...(parsed.completed ?? {}) },
      isDismissed: Boolean(parsed.isDismissed),
    };
  } catch {
    return { completed: defaultCompleted, isDismissed: false };
  }
}

function saveState(state: Pick<LearningProgressState, 'completed' | 'isDismissed'>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const LEARNING_PROGRESS_STORAGE_KEY = STORAGE_KEY;

export const useLearningProgressStore = create<LearningProgressState>((set, get) => {
  const initial = readState();

  return {
    completed: initial.completed,
    isDismissed: initial.isDismissed,

    mark: (step) => {
      const completed = { ...get().completed, [step]: true };
      const next = { completed, isDismissed: false };
      saveState(next);
      set(next);
    },

    dismiss: () => {
      const next = { completed: get().completed, isDismissed: true };
      saveState(next);
      set(next);
    },

    reset: () => {
      const next = { completed: defaultCompleted, isDismissed: false };
      saveState(next);
      set(next);
    },
  };
});
