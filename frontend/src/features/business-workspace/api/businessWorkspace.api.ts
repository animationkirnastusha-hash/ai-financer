import { apiClient } from '@/shared/api/client';
import type { SubscriptionAccess } from '@/features/subscription/api/subscription.api';

export type BusinessProfileType = 'self_employed' | 'ip' | 'small_business' | string;

export type BusinessWorkspaceDto = {
  id: string;
  profileType: BusinessProfileType;
  displayName: string | null;
  taxMode: string | null;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  monthlyIncomePlan: number;
  monthlyExpensePlan: number;
  reminderDay: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessWorkspaceAccountDto = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
};

export type BusinessWorkspaceSummaryDto = {
  monthIncome: number;
  monthExpense: number;
  profit: number;
  incomePlan: number;
  expensePlan: number;
  incomeProgress: number;
  expenseProgress: number;
  activeLoans: number;
  upcomingReminders: number;
  recentTransactions?: Array<{
    id: string;
    title: string | null;
    type: string;
    amount: number;
    date: string;
    accountName: string | null;
    categoryName: string | null;
    currency: string;
  }>;
  nextPayments?: Array<{
    id: string;
    type: string;
    title: string;
    amount: number;
    date: string;
    accountName: string | null;
    currency: string;
  }>;
  insights?: Array<{ type: string; title: string; caption: string }>;
};

export type BusinessWorkspacePayload = {
  access: SubscriptionAccess;
  workspace: BusinessWorkspaceDto;
  summary: BusinessWorkspaceSummaryDto;
  accounts: BusinessWorkspaceAccountDto[];
};

export type UpdateBusinessWorkspacePayload = Partial<{
  profileType: BusinessProfileType;
  displayName: string | null;
  taxMode: string | null;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  monthlyIncomePlan: number;
  monthlyExpensePlan: number;
  reminderDay: number | null;
}>;

export const businessWorkspaceApi = {
  me: () => apiClient.get<BusinessWorkspacePayload>('/business-workspace/me'),
  update: (payload: UpdateBusinessWorkspacePayload) => apiClient.put<Pick<BusinessWorkspacePayload, 'workspace' | 'summary'>>('/business-workspace/me', payload),
};
