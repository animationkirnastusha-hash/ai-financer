import { apiClient } from '@/shared/api/client';

export type GoalDto = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  accountId?: string | null;
  account?: { id: string; name: string; currency: string; icon?: string | null; color?: string | null } | null;
  status: 'active' | 'completed' | 'archived' | string;
  note?: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  accountId?: string | null;
  note?: string | null;
};

export type UpdateGoalInput = Partial<CreateGoalInput> & {
  status?: 'active' | 'completed' | 'archived';
};

function unwrapGoal(payload: { goal?: GoalDto } | GoalDto) {
  return 'goal' in payload && payload.goal ? payload.goal : payload as GoalDto;
}

export const goalsApi = {
  async list() {
    const payload = await apiClient.get<{ goals?: GoalDto[] } | GoalDto[]>('/goals');
    return Array.isArray(payload) ? payload : payload.goals ?? [];
  },

  async create(input: CreateGoalInput) {
    const payload = await apiClient.post<{ goal?: GoalDto } | GoalDto>('/goals', input);
    return unwrapGoal(payload);
  },

  async update(id: string, input: UpdateGoalInput) {
    const payload = await apiClient.patch<{ goal?: GoalDto } | GoalDto>(`/goals/${id}`, input);
    return unwrapGoal(payload);
  },

  async delete(id: string) {
    const payload = await apiClient.delete<{ goal?: GoalDto } | GoalDto>(`/goals/${id}`);
    return unwrapGoal(payload);
  },
};
