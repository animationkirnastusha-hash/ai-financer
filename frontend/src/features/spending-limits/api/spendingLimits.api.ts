import { apiClient } from '@/shared/api/client';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CategoryDto } from '@/features/sections/api/sections.api';

export type SpendingLimitTargetType = 'account' | 'category' | 'total';
export type SpendingLimitPeriod = 'daily' | 'weekly' | 'monthly';

export type SpendingLimitUsageDto = {
  spent: number;
  remaining: number;
  percent: number;
  periodStartedAt: string;
};

export type SpendingLimitDto = {
  id: string;
  userId: string;
  targetType: SpendingLimitTargetType;
  accountId?: string | null;
  categoryId?: string | null;
  amount: number;
  period: SpendingLimitPeriod;
  notifyAt: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  account?: AccountDto | null;
  category?: CategoryDto | null;
  usage?: SpendingLimitUsageDto;
};

export type CreateSpendingLimitPayload = {
  targetType: SpendingLimitTargetType;
  accountId?: string | null;
  categoryId?: string | null;
  amount: number;
  period: SpendingLimitPeriod;
  notifyAt?: number;
  isActive?: boolean;
};

export type UpdateSpendingLimitPayload = Partial<CreateSpendingLimitPayload>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function extractLimit(payload: SpendingLimitDto | { limit?: SpendingLimitDto }) {
  if ('limit' in payload && payload.limit) return payload.limit;
  return payload as SpendingLimitDto;
}

export async function fetchSpendingLimits(): Promise<SpendingLimitDto[]> {
  try {
    const payload = await apiClient.get<{ limits?: SpendingLimitDto[] }>('/spending-limits');
    return Array.isArray(payload.limits) ? payload.limits : [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось загрузить лимиты'));
  }
}

export async function createSpendingLimit(payload: CreateSpendingLimitPayload): Promise<SpendingLimitDto> {
  try {
    return extractLimit(await apiClient.post<{ limit: SpendingLimitDto }>('/spending-limits', payload));
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось создать лимит'));
  }
}

export async function updateSpendingLimit(limitId: string, payload: UpdateSpendingLimitPayload): Promise<SpendingLimitDto> {
  try {
    return extractLimit(await apiClient.put<{ limit: SpendingLimitDto }>(`/spending-limits/${limitId}`, payload));
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось обновить лимит'));
  }
}

export async function deleteSpendingLimit(limitId: string): Promise<void> {
  try {
    await apiClient.delete(`/spending-limits/${limitId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось удалить лимит'));
  }
}
