import { apiClient } from '@/shared/api/client';

export type ReferralUserDto = {
  id: string;
  firstName: string;
  username: string | null;
  createdAt?: string;
};

export type ReferralTransactionDto = {
  id: string;
  amount: number;
  level: number;
  type: string;
  status: string;
  createdAt: string;
  fromUser: ReferralUserDto;
};

export type ReferralInfo = {
  referralCode: string | null;
  referralBalance: number;
  referrer: ReferralUserDto | null;
  referrals: ReferralUserDto[];
  referralTransactions: ReferralTransactionDto[];
};

export type ReferralInfoDto = ReferralInfo;

type ReferralResponse = {
  referral: ReferralInfo;
};

function unwrapReferral(payload: ReferralResponse | ReferralInfo): ReferralInfo {
  return 'referral' in payload ? payload.referral : payload;
}

export async function fetchReferralInfo(): Promise<ReferralInfoDto> {
  const payload = await apiClient.get<ReferralResponse>('/referral');
  return unwrapReferral(payload);
}

export async function applyReferralCode(code: string): Promise<ReferralInfoDto> {
  const payload = await apiClient.post<ReferralResponse>('/referral/apply', { code });
  return unwrapReferral(payload);
}

export const referralApi = {
  getInfo: () => apiClient.get<ReferralResponse>('/referral'),
  applyCode: (code: string) => apiClient.post<ReferralResponse>('/referral/apply', { code }),
};
