import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';

export function isPremiumPreviewEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('ai-financer-premium-preview') === '1';
  } catch {
    return false;
  }
}

export function hasPremiumAccess(subscription: SubscriptionStatusDto | null | undefined) {
  return Boolean(subscription?.access?.hasPremium || subscription?.access?.hasBusiness);
}

export function hasBusinessAccess(subscription: SubscriptionStatusDto | null | undefined) {
  return Boolean(subscription?.access?.hasBusiness);
}

export function canShowMonetization(subscription: SubscriptionStatusDto | null | undefined) {
  return Boolean(hasPremiumAccess(subscription) || isPremiumPreviewEnabled());
}

export function canShowBusiness(subscription: SubscriptionStatusDto | null | undefined) {
  return Boolean(hasBusinessAccess(subscription));
}

export function canUseReceiptScan(subscription: SubscriptionStatusDto | null | undefined) {
  return Boolean(subscription?.features?.receiptScan || hasPremiumAccess(subscription));
}
