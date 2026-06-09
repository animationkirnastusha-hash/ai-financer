export type AISettingsPreset = 'strict' | 'balanced' | 'simple' | 'fast';
export type CompanionTone = 'calm' | 'friendly' | 'strict' | 'coach';

export interface AISettingsUpdateInput {
  preset?: AISettingsPreset;
  defaultExpenseAccountId?: string | null;
  defaultIncomeAccountId?: string | null;
  autoConfirmExpenseLimit?: number;
  autoConfirmIncomeLimit?: number;
  autoConfirmTransferLimit?: number;
  requireConfirmForAccountActions?: boolean;
  companionTone?: CompanionTone;
}

export interface OnboardingUpdateInput {
  status?: 'not_started' | 'active' | 'completed';
  currentStep?: string | null;
  skipped?: boolean;
  meta?: unknown;
}
