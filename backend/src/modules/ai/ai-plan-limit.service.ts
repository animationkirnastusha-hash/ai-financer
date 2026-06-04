import { AIActionPlan } from './types';

const DEFAULT_MAX_ACTIONS = 3;

export class AIPlanLimitService {
  constructor(private readonly maxActions = DEFAULT_MAX_ACTIONS) {}

  getLimit() {
    return this.maxActions;
  }

  isExceeded(plan: AIActionPlan) {
    return plan.actions.length > this.maxActions;
  }
}
