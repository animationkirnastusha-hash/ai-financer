import { apiClient } from '@/shared/api/client';

export type SalaryPeriod = 'monthly' | 'biweekly' | 'manual' | string;

export type FinancialCycleDto = {
  id: string;
  userId: string;
  salaryDay: number | null;
  salaryAmount: number;
  salaryCurrency: string;
  salaryAccountId: string | null;
  salaryPeriod: SalaryPeriod;
  remindBeforeDays: number;
  autoCreateIncome: boolean;
  autoDistributeGoals: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinancialCycleUpdatePayload = {
  salaryDay?: number | string | null;
  salaryAmount?: number | string | null;
  salaryCurrency?: string | null;
  salaryAccountId?: string | null;
  salaryPeriod?: SalaryPeriod | null;
  remindBeforeDays?: number | string | null;
  autoCreateIncome?: boolean | null;
  autoDistributeGoals?: boolean | null;
};

function unwrap(payload: { financialCycle?: FinancialCycleDto } | FinancialCycleDto) {
  return 'financialCycle' in payload && payload.financialCycle ? payload.financialCycle : payload as FinancialCycleDto;
}

export const financialCycleApi = {
  async get() {
    const payload = await apiClient.get<{ financialCycle?: FinancialCycleDto } | FinancialCycleDto>('/financial-cycle');
    return unwrap(payload);
  },

  async update(input: FinancialCycleUpdatePayload) {
    const payload = await apiClient.patch<{ financialCycle?: FinancialCycleDto } | FinancialCycleDto>('/financial-cycle', input);
    return unwrap(payload);
  },
};
