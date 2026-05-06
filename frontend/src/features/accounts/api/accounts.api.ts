import { env } from '@/shared/config/env';

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

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function readPayload(response: Response) {
  return response.json().catch(() => null);
}

function getErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message || payload?.message || fallback;
}

export async function fetchAccounts(): Promise<AccountDto[]> {
  const response = await fetch(`${env.apiBaseUrl}/accounts`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to fetch accounts'));
  }

  return Array.isArray(payload?.accounts) ? payload.accounts : [];
}

export async function createAccount(input: CreateAccountPayload): Promise<AccountDto> {
  const response = await fetch(`${env.apiBaseUrl}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
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
    }),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to create account'));
  }

  return payload.account;
}

export async function updateAccountRequest(accountId: string, input: UpdateAccountPayload): Promise<AccountDto> {
  const response = await fetch(`${env.apiBaseUrl}/accounts/${accountId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Не удалось обновить счёт'));
  }

  return payload.account;
}

export async function deleteAccountRequest(accountId: string): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}/accounts/${accountId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Не удалось удалить счёт'));
  }
}
