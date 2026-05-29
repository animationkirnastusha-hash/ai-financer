import type { AppCurrency } from '@/features/settings/model/settings.types';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type OnboardingReminderTiming = 'same_day' | 'one_day' | 'three_days' | 'off';

export type OnboardingLoanKind = 'credit' | 'mortgage' | 'installment' | 'loan';

export type OnboardingAccountDraft = {
  id: 'cash' | 'card';
  enabled: boolean;
  name: string;
  type: 'cash' | 'card';
  balance: number;
};

export type OnboardingLoanDraft = {
  enabled: boolean;
  kind: OnboardingLoanKind;
  title: string;
  remainingAmount: number;
  monthlyPayment: number;
  paymentDay: number;
  rate?: number;
  termMonths?: number;
};

export type OnboardingGoalDraft = {
  enabled: boolean;
  title: string;
  targetAmount: number;
};

export type OnboardingRemindersDraft = {
  timing: OnboardingReminderTiming;
  creditPayments: boolean;
  goals: boolean;
  regularExpenses: boolean;
  weeklySummary: boolean;
};

export type OnboardingVoiceDraft = {
  voiceEnabled: boolean;
  textFallbackEnabled: boolean;
  testPhrase: string;
};

export type OnboardingDraft = {
  currency: AppCurrency;
  accounts: OnboardingAccountDraft[];
  loan: OnboardingLoanDraft;
  goal: OnboardingGoalDraft;
  reminders: OnboardingRemindersDraft;
  voice: OnboardingVoiceDraft;
  focus: 'personal' | 'saving' | 'debt' | 'business';
};
