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
import SettingsPage from '@/pages/settings/SettingsPage';
import TaxonomySettingsPage from '@/pages/settings/TaxonomySettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import SectionsPage from '@/pages/sections/SectionsPage';
import { AICoreScreen } from '@/features/ai-core/ui/AICoreScreen';

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const goBack = useNavigationStore((state) => state.goBack);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isGlobalCommandListOpen = useNavigationStore((state) => state.isGlobalCommandListOpen);
  const closeGlobalCommandList = useNavigationStore((state) => state.closeGlobalCommandList);

  const isCreateAccountOpen = useAccountFlowStore((state) => state.isCreateAccountOpen);
  const closeCreateAccount = useAccountFlowStore((state) => state.closeCreateAccount);
  const createAccount = useAccountsStore((state) => state.createAccount);

  const runGlobalCommand = (command: string) => {
    const input = command.trim().toLowerCase().replaceAll('ё', 'е');

    if (input.includes('аналит') || input.includes('анализ') || input.includes('сравни')) return navigateTo('analytics');
    if (input.includes('цель') || input.includes('копил') || input.includes('подуш')) return navigateTo('goals');
    if (input.includes('прем') || input.includes('premium')) return navigateTo('premium');
    if (input.includes('компань') || input.includes('companion') || input.includes('ассист')) return navigateTo('companion');
    if (input.includes('счет') || input.includes('карта') || input.includes('баланс')) return navigateTo('accounts');
    if (input.includes('операц') || input.includes('транзак') || input.includes('расход') || input.includes('доход')) return navigateTo('transactions');
    if (input.includes('настрой') || input.includes('settings')) return navigateTo('settings');

    navigateTo('dashboard');
  };

  return (
    <AppShell>
      {currentScreen === 'dashboard' && <DashboardPage />}
      {currentScreen === 'transactions' && <TransactionsPage onBack={goBack} />}
      {currentScreen === 'accounts' && <AccountsPage />}
      {currentScreen === 'analytics' && <AnalyticsPage />}
      {currentScreen === 'goals' && <GoalsPage />}
      {currentScreen === 'companion' && <CompanionPage />}
      {currentScreen === 'settings' && <SettingsPage />}
      {currentScreen === 'premium' && <PremiumPage />}
      {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
      {currentScreen === 'taxonomy-settings' && <TaxonomySettingsPage />}
      {currentScreen === 'ai-core' && <AICoreScreen />}

      <CommandListSheet open={isGlobalCommandListOpen} onClose={closeGlobalCommandList} onRunCommand={runGlobalCommand} />

      <CreateAccountSheet
        open={isCreateAccountOpen}
        onClose={closeCreateAccount}
        onSubmit={async (payload) => {
          await createAccount(payload);
          navigateTo('accounts');
        }}
      />

      <PremiumUpgradeSheet />
      <LaunchOnboardingSheet />
    </AppShell>
  );
}
