import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';

export function hasRealPremiumAccess(subscription: SubscriptionStatusDto | null | undefined): boolean {
  return Boolean(subscription?.access?.hasPremium);
}

export function hasRealBusinessAccess(subscription: SubscriptionStatusDto | null | undefined): boolean {
  return Boolean(subscription?.access?.hasBusiness);
}

export function hasPaidAccess(subscription: SubscriptionStatusDto | null | undefined): boolean {
  return hasRealPremiumAccess(subscription) || hasRealBusinessAccess(subscription);
}

export function hasFeatureAccess(subscription: SubscriptionStatusDto | null | undefined, feature: string): boolean {
  return Boolean(subscription?.features?.[feature]);
}

export function canShowStoreSurface(subscription: SubscriptionStatusDto | null | undefined): boolean {
  return hasPaidAccess(subscription);
}
