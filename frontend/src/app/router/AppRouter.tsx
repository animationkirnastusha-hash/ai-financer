import { AppShell } from '@/shared/ui/AppShell';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { AppNavigationSheet } from '@/features/navigation/ui/AppNavigationSheet';
import { AppModalManager } from '@/features/modals/ui/AppModalManager';
import { PremiumUpgradeSheet } from '@/features/premium/ui/PremiumUpgradeSheet';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';

import AccountsPage from '@/pages/accounts/AccountsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import CompanionPage from '@/pages/companion/CompanionPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import GoalsPage from '@/pages/goals/GoalsPage';
import PremiumPage from '@/pages/premium/PremiumPage';
import BusinessAccountantPage from '@/pages/business-accountant/BusinessAccountantPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import SectionsPage from '@/pages/sections/SectionsPage';
import AdminPage from '@/pages/admin/AdminPage';
import ReferralPage from '@/pages/referral/ReferralPage';
import { AICoreScreen } from '@/features/ai-core/ui/AICoreScreen';
import { ProductAnalyticsTracker } from '@/features/product-analytics/ui/ProductAnalyticsTracker';
import { useAuthStore } from '@/features/auth/model/auth.store';

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
  const goBack = useNavigationStore((state) => state.goBack);

  return (
    <AppShell>
      <ProductAnalyticsTracker />
      {currentScreen === 'dashboard' && <DashboardPage />}
      {currentScreen === 'accounts' && <AccountsPage />}
      {currentScreen === 'analytics' && <AnalyticsPage />}
      {currentScreen === 'goals' && <GoalsPage />}
      {currentScreen === 'companion' && <CompanionPage />}
      {currentScreen === 'settings' && <SettingsPage />}
      {currentScreen === 'premium' && (isAdmin ? <PremiumPage /> : <DashboardPage />)}
      {currentScreen === 'business-accountant' && (isAdmin ? <BusinessAccountantPage /> : <DashboardPage />)}
      {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
      {currentScreen === 'ai-core' && <AICoreScreen />}
      {currentScreen === 'admin' && <AdminPage />}
      {currentScreen === 'referral' && (isAdmin ? <ReferralPage /> : <DashboardPage />)}

      <AppNavigationSheet />
      <AppModalManager />
      {isAdmin ? <PremiumUpgradeSheet /> : null}
      <LaunchOnboardingSheet />
    </AppShell>
  );
}
