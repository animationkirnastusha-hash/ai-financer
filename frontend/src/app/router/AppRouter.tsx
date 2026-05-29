import { AppShell } from '@/shared/ui/AppShell';
import { CreateAccountSheet } from '@/features/accounts/ui/CreateAccountSheet';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
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
import TaxonomySettingsPage from '@/pages/settings/TaxonomySettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import SectionsPage from '@/pages/sections/SectionsPage';
import AdminPage from '@/pages/admin/AdminPage';
import ReferralPage from '@/pages/referral/ReferralPage';
import { AICoreScreen } from '@/features/ai-core/ui/AICoreScreen';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { ProductAnalyticsTracker } from '@/features/product-analytics/ui/ProductAnalyticsTracker';
import { useAuthStore } from '@/features/auth/model/auth.store';

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
  const goBack = useNavigationStore((state) => state.goBack);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const isGlobalCommandListOpen = useNavigationStore((state) => state.isGlobalCommandListOpen);
  const closeGlobalCommandList = useNavigationStore((state) => state.closeGlobalCommandList);

  const isCreateAccountOpen = useAccountFlowStore((state) => state.isCreateAccountOpen);
  const closeCreateAccount = useAccountFlowStore((state) => state.closeCreateAccount);
  const createAccount = useAccountsStore((state) => state.createAccount);

  const runGlobalCommand = (command: string) => {
    const navigationIntent = parseNavigationIntent(command);

    if (navigationIntent.type === 'open_screen') {
      if (!isAdmin && (navigationIntent.screen === 'premium' || navigationIntent.screen === 'referral' || navigationIntent.screen === 'business-accountant')) {
        return;
      }
      navigateTo(navigationIntent.screen);
      return;
    }

    if (navigationIntent.type === 'go_back') {
      goBack();
      return;
    }

    openAIWithCommand(command);
  };

  return (
    <AppShell>
      <ProductAnalyticsTracker />
      {currentScreen === 'dashboard' && <DashboardPage />}
      {currentScreen === 'transactions' && <TransactionsPage />}
      {currentScreen === 'accounts' && <AccountsPage />}
      {currentScreen === 'analytics' && <AnalyticsPage />}
      {currentScreen === 'goals' && <GoalsPage />}
      {currentScreen === 'companion' && <CompanionPage />}
      {currentScreen === 'settings' && <SettingsPage />}
      {currentScreen === 'premium' && (isAdmin ? <PremiumPage /> : <DashboardPage />)}
      {currentScreen === 'business-accountant' && (isAdmin ? <BusinessAccountantPage /> : <DashboardPage />)}
      {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
      {currentScreen === 'taxonomy-settings' && <TaxonomySettingsPage />}
      {currentScreen === 'ai-core' && <AICoreScreen />}
      {currentScreen === 'admin' && <AdminPage />}
      {currentScreen === 'referral' && (isAdmin ? <ReferralPage /> : <DashboardPage />)}

      <CommandListSheet open={isGlobalCommandListOpen} onClose={closeGlobalCommandList} onRunCommand={runGlobalCommand} />

      <CreateAccountSheet
        open={isCreateAccountOpen}
        onClose={closeCreateAccount}
        onSubmit={async (payload) => {
          await createAccount(payload);
          navigateTo('accounts');
        }}
      />

      {isAdmin ? <PremiumUpgradeSheet /> : null}
      <LaunchOnboardingSheet />
    </AppShell>
  );
}
