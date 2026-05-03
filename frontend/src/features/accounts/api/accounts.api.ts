import { env } from '@/shared/config/env';

export type AccountDto = {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  showInTotalBalance: boolean;
  icon?: string | null;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CreateAccountPayload = {
  name: string;
  type: 'card' | 'cash' | 'savings' | 'investment';
  currency: 'RUB' | 'USD' | 'EUR';
  initialBalance: number;
};

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchAccounts(): Promise<AccountDto[]> {
  const response = await fetch(`${env.apiBaseUrl}/accounts`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        'Failed to fetch accounts',
    );
  }

  return Array.isArray(payload?.accounts) ? payload.accounts : [];
}

export async function createAccount(
  input: CreateAccountPayload,
): Promise<AccountDto> {
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
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        'Failed to create account',
    );
  }

  return payload.account;
}

export async function deleteAccountRequest(accountId: string): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}/accounts/${accountId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        'Не удалось удалить счёт',
    );
  }
}