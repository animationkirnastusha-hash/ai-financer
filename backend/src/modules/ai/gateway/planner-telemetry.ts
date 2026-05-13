export interface PlannerTelemetry {
  elapsedMs: number;
  promptChars: number;
  model: string;
}

export function logPlannerTelemetry(
  telemetry: PlannerTelemetry
): void {
  console.log('[PLANNER]', telemetry);
}
