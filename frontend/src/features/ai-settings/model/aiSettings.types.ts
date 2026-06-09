export type AISettingsPreset = 'strict' | 'balanced' | 'simple' | 'fast';
export type CompanionTone = 'calm' | 'friendly' | 'strict' | 'coach';

export type AISettingsDto = {
  id: string;
  userId: string;
  preset: AISettingsPreset | string;
  defaultExpenseAccountId: string | null;
  defaultIncomeAccountId: string | null;
  autoConfirmExpenseLimit: number;
  autoConfirmIncomeLimit: number;
  autoConfirmTransferLimit: number;
  requireConfirmForAccountActions: boolean;
  companionTone: CompanionTone | string;
  createdAt?: string;
  updatedAt?: string;
};

export type AISettingsAccountDto = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
};

export type AISettingsSnapshot = {
  userId: string;
  settings: AISettingsDto | null;
  accounts: AISettingsAccountDto[];
  recommendedPresets?: Array<{
    key: AISettingsPreset | string;
    title: string;
    description: string;
  }>;
};

export type AISettingsUpdatePayload = Partial<{
  preset: AISettingsPreset;
  defaultExpenseAccountId: string | null;
  defaultIncomeAccountId: string | null;
  autoConfirmExpenseLimit: number;
  autoConfirmIncomeLimit: number;
  autoConfirmTransferLimit: number;
  requireConfirmForAccountActions: boolean;
  companionTone: CompanionTone;
}>;
