export const HOME_GOAL_SELECTION_STORAGE_KEY = 'fina.home.goal.selection.v1';
export const HOME_GOAL_SELECTION_EVENT = 'fina:home-goal-selection-changed';

export function readHomeGoalSelection() {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(HOME_GOAL_SELECTION_STORAGE_KEY);
  return value && value.trim() ? value : null;
}

export function writeHomeGoalSelection(goalId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HOME_GOAL_SELECTION_STORAGE_KEY, goalId);
  window.dispatchEvent(new CustomEvent(HOME_GOAL_SELECTION_EVENT, { detail: { goalId } }));
}

export function clearHomeGoalSelection() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(HOME_GOAL_SELECTION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(HOME_GOAL_SELECTION_EVENT, { detail: { goalId: null } }));
}
