export type ActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed';

export type ActionEntity = {
  id: string;
  title: string;
  description?: string;
  status: ActionStatus;
  createdAt: string;
  meta?: Record<string, unknown>;
};