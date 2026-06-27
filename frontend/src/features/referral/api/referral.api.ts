import { apiClient } from '@/shared/api/client';

export type ReferralUserDto = {
  id: string;
  firstName: string;
  username?: string | null;
  createdAt: string;
  actionsCount?: number;
  activeDays?: number;
  activated?: boolean;
};

export type ReferralTransactionDto = {
  id: string;
  userId: string;
  fromUserId: string;
  amount: number;
  level: number;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  fromUser?: ReferralUserDto | null;
};

export type ReferralInfoDto = {
  referralCode: string | null;
  referralBalance: number;
  referrer: { id: string; firstName: string; username?: string | null } | null;
  referrals: ReferralUserDto[];
  referralTransactions: ReferralTransactionDto[];
  rules?: {
    activationDaysRequired: number;
    activationActionsRequired: number;
    purchaseBonusRate: number;
  };
};

type ReferralPayload = { referral: ReferralInfoDto } | ReferralInfoDto;

function unwrapReferral(payload: ReferralPayload): ReferralInfoDto {
  return 'referral' in payload ? payload.referral : payload;
}

export async function fetchReferralInfo(): Promise<ReferralInfoDto> {
  const response = await apiClient.get<{ referral: ReferralInfoDto }>('/referral');
  return unwrapReferral(response);
}

export async function applyReferralCode(code: string): Promise<ReferralInfoDto> {
  const response = await apiClient.post<{ referral: ReferralInfoDto }>('/referral/apply', { code });
  return unwrapReferral(response);
}

export const referralApi = {
  me: fetchReferralInfo,
  getInfo: fetchReferralInfo,
  applyCode: applyReferralCode,
};
