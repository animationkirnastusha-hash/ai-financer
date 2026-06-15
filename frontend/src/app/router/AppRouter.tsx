import { lazy, Suspense, useEffect } from 'react';
import { AppShell } from '@/shared/ui/AppShell';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { AppNavigationSheet } from '@/features/navigation/ui/AppNavigationSheet';
import { AppModalManager } from '@/features/modals/ui/AppModalManager';
import { PremiumUpgradeSheet } from '@/features/premium/ui/PremiumUpgradeSheet';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';
import { ProductTourOverlay } from '@/features/onboarding/ui/ProductTourOverlay';
import { ProductAnalyticsTracker } from '@/features/product-analytics/ui/ProductAnalyticsTracker';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { canShowStoreSurface, hasFeatureAccess, hasRealBusinessAccess } from '@/features/subscription/lib/entitlements';
import { Spinner } from '@/shared/ui/Spinner';

const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const JournalPage = lazy(() => import('@/pages/journal/JournalPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const CompanionPage = lazy(() => import('@/pages/companion/CompanionPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'));
const ObligationsPage = lazy(() => import('@/pages/obligations/ObligationsPage'));
const SpendingLimitsPage = lazy(() => import('@/pages/spending-limits/SpendingLimitsPage'));
const PremiumPage = lazy(() => import('@/pages/premium/PremiumPage'));
const BusinessAccountantPage = lazy(() => import('@/pages/business-accountant/BusinessAccountantPage'));
const ReceiptScansPage = lazy(() => import('@/pages/receipt-scans/ReceiptScansPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const SectionsPage = lazy(() => import('@/pages/sections/SectionsPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const ReferralPage = lazy(() => import('@/pages/referral/ReferralPage'));

function RouteFallback() {
  return (
    <div className="app-screen app-screen--loading">
      <Spinner />
    </div>
  );
}

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const goBack = useNavigationStore((state) => state.goBack);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const hasBusiness = hasRealBusinessAccess(subscription);
  const canShowStore = canShowStoreSurface(subscription);
  const canShowReceipts = hasFeatureAccess(subscription, 'receiptScan');

  useEffect(() => {
    if (user) void loadSubscription();
  }, [loadSubscription, user]);

  return (
    <AppShell>
      <ProductAnalyticsTracker />
      <Suspense fallback={<RouteFallback />}>
        {currentScreen === 'dashboard' && <DashboardPage />}
        {currentScreen === 'accounts' && <AccountsPage />}
        {currentScreen === 'journal' && <JournalPage />}
        {currentScreen === 'profile' && <ProfilePage />}
        {currentScreen === 'analytics' && <AnalyticsPage />}
        {currentScreen === 'goals' && <GoalsPage />}
        {currentScreen === 'obligations' && <ObligationsPage />}
        {currentScreen === 'spending-limits' && <SpendingLimitsPage />}
        {currentScreen === 'companion' && <CompanionPage />}
        {currentScreen === 'settings' && <SettingsPage />}
        {currentScreen === 'store' && (canShowStore ? <PremiumPage /> : <DashboardPage />)}
        {currentScreen === 'premium' && (canShowStore ? <PremiumPage /> : <DashboardPage />)}
        {currentScreen === 'business-accountant' && (hasBusiness ? <BusinessAccountantPage /> : <DashboardPage />)}
        {currentScreen === 'receipt-scans' && (canShowReceipts ? <ReceiptScansPage /> : <DashboardPage />)}
        {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
        {currentScreen === 'admin' && (isAdmin ? <AdminPage /> : <DashboardPage />)}
        {currentScreen === 'referral' && <ReferralPage />}
      </Suspense>

      <AppNavigationSheet />
      <AppModalManager />
      {canShowStore ? <PremiumUpgradeSheet /> : null}
      <LaunchOnboardingSheet />
      <ProductTourOverlay />
    </AppShell>
  );
}
