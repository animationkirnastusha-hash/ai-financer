import { lazy, Suspense } from 'react';
import { AppShell } from '@/shared/ui/AppShell';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { AppNavigationSheet } from '@/features/navigation/ui/AppNavigationSheet';
import { AppModalManager } from '@/features/modals/ui/AppModalManager';
import { PremiumUpgradeSheet } from '@/features/premium/ui/PremiumUpgradeSheet';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';
import { ProductAnalyticsTracker } from '@/features/product-analytics/ui/ProductAnalyticsTracker';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Spinner } from '@/shared/ui/Spinner';

const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const CompanionPage = lazy(() => import('@/pages/companion/CompanionPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'));
const ObligationsPage = lazy(() => import('@/pages/obligations/ObligationsPage'));
const PremiumPage = lazy(() => import('@/pages/premium/PremiumPage'));
const BusinessAccountantPage = lazy(() => import('@/pages/business-accountant/BusinessAccountantPage'));
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
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
  const goBack = useNavigationStore((state) => state.goBack);

  return (
    <AppShell>
      <ProductAnalyticsTracker />
      <Suspense fallback={<RouteFallback />}>
        {currentScreen === 'dashboard' && <DashboardPage />}
        {currentScreen === 'accounts' && <AccountsPage />}
        {currentScreen === 'analytics' && <AnalyticsPage />}
        {currentScreen === 'goals' && <GoalsPage />}
        {currentScreen === 'obligations' && <ObligationsPage />}
        {currentScreen === 'companion' && <CompanionPage />}
        {currentScreen === 'settings' && <SettingsPage />}
        {currentScreen === 'store' && <PremiumPage />}
        {currentScreen === 'premium' && <PremiumPage />}
        {currentScreen === 'business-accountant' && (isAdmin ? <BusinessAccountantPage /> : <DashboardPage />)}
        {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
        {currentScreen === 'admin' && (isAdmin ? <AdminPage /> : <DashboardPage />)}
        {currentScreen === 'referral' && (isAdmin ? <ReferralPage /> : <DashboardPage />)}
      </Suspense>

      <AppNavigationSheet />
      <AppModalManager />
      {isAdmin ? <PremiumUpgradeSheet /> : null}
      <LaunchOnboardingSheet />
    </AppShell>
  );
}
