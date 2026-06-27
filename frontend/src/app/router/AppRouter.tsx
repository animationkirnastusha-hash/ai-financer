import { lazy, Suspense } from 'react';
import { AppShell } from '@/shared/ui/AppShell';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { AppNavigationSheet } from '@/features/navigation/ui/AppNavigationSheet';
import { AppModalManager } from '@/features/modals/ui/AppModalManager';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';
import { ProductAnalyticsTracker } from '@/features/product-analytics/ui/ProductAnalyticsTracker';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Spinner } from '@/shared/ui/Spinner';

const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const JournalPage = lazy(() => import('@/pages/journal/JournalPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const CompanionPage = lazy(() => import('@/pages/companion/CompanionPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const GoalsLimitsPage = lazy(() => import('@/pages/goals-limits/GoalsLimitsPage'));
const PaymentsPage = lazy(() => import('@/pages/payments/PaymentsPage'));
const StorePage = lazy(() => import('@/pages/store/StorePage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const ReferralPage = lazy(() => import('@/pages/referral/ReferralPage'));
const SectionsPage = lazy(() => import('@/pages/sections/SectionsPage'));

function RouteFallback() {
  return (
    <div className="app-screen app-screen--loading">
      <Spinner />
    </div>
  );
}

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const goBack = useNavigationStore((state) => state.goBack);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell>
      <ProductAnalyticsTracker />
      <Suspense fallback={<RouteFallback />}>
        {currentScreen === 'dashboard' && <DashboardPage />}
        {currentScreen === 'accounts' && <AccountsPage />}
        {currentScreen === 'journal' && <JournalPage />}
        {currentScreen === 'profile' && <ProfilePage />}
        {currentScreen === 'analytics' && <AnalyticsPage />}
        {(currentScreen === 'goals' || currentScreen === 'goals-limits' || currentScreen === 'spending-limits') && <GoalsLimitsPage />}
        {(currentScreen === 'obligations' || currentScreen === 'payments') && <PaymentsPage />}
        {currentScreen === 'store' && <StorePage />}
        {currentScreen === 'companion' && <CompanionPage />}
        {currentScreen === 'settings' && <SettingsPage />}
        {currentScreen === 'admin' && (isAdmin ? <AdminPage /> : <DashboardPage />)}
        {currentScreen === 'referral' && <ReferralPage />}
        {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
      </Suspense>

      <AppNavigationSheet />
      <AppModalManager />
      <LaunchOnboardingSheet />
    </AppShell>
  );
}
