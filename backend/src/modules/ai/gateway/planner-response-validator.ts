export interface PlannerAction {
  tool: string;
  params: Record<string, unknown>;
}

export interface PlannerResult {
  actions: PlannerAction[];
}

export function validatePlannerResult(
  result: PlannerResult,
  allowedTools: string[]
): void {
  if (!Array.isArray(result.actions)) {
    throw new Error('Planner actions invalid');
  }

  for (const action of result.actions) {
    if (!allowedTools.includes(action.tool)) {
      throw new Error(`Unknown tool: ${action.tool}`);
    }

    if (typeof action.params !== 'object') {
      throw new Error(`Invalid params for tool: ${action.tool}`);
    }
  }
}
