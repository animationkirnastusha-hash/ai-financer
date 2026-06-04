import { apiClient } from '@/shared/api/client';

export type AccountDto = {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  showInTotalBalance: boolean;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
  icon?: string | null;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
  transactionCount?: number;
};

type CreateAccountPayload = {
  name: string;
  type: 'card' | 'cash' | 'savings' | 'investment';
  currency: 'RUB' | 'USD' | 'EUR';
  initialBalance: number;
  showInTotalBalance?: boolean;
  icon?: string | null;
  color?: string | null;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
};

export type UpdateAccountPayload = Partial<{
  name: string;
  type: string;
  currency: string;
  balance: number;
  showInTotalBalance: boolean;
  icon: string | null;
  color: string | null;
  lockRename: boolean;
  lockSpending: boolean;
  lockTransfers: boolean;
  lockBalance: boolean;
  lockVisibility: boolean;
}>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function fetchAccounts(): Promise<AccountDto[]> {
  try {
    const payload = await apiClient.get<{ accounts?: AccountDto[] }>('/accounts');
    return Array.isArray(payload.accounts) ? payload.accounts : [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to fetch accounts'));
  }
}

export async function createAccount(input: CreateAccountPayload): Promise<AccountDto> {
  try {
    const payload = await apiClient.post<{ account: AccountDto }>('/accounts', {
      name: input.name,
      type: input.type,
      currency: input.currency,
      balance: input.initialBalance,
      showInTotalBalance: input.showInTotalBalance,
      icon: input.icon,
      color: input.color,
      lockRename: input.lockRename,
      lockSpending: input.lockSpending,
      lockTransfers: input.lockTransfers,
      lockBalance: input.lockBalance,
      lockVisibility: input.lockVisibility,
    });
    return payload.account;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to create account'));
  }
}

export async function updateAccountRequest(accountId: string, input: UpdateAccountPayload): Promise<AccountDto> {
  try {
    const payload = await apiClient.put<{ account: AccountDto }>(`/accounts/${accountId}`, input);
    return payload.account;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось обновить счёт'));
  }
}

export async function deleteAccountRequest(accountId: string): Promise<void> {
  try {
    await apiClient.delete(`/accounts/${accountId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось удалить счёт'));
  }
}
