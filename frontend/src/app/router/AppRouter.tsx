import { AICoreScreen } from '@/features/ai-core/ui/AICoreScreen';
import { AIAssistantDock } from '@/features/ai-core/ui/AIAssistantDock';
import { AIMenuSheet } from '@/features/ai-core/ui/AIMenuSheet';
import { CreateAccountSheet } from '@/features/accounts/ui/CreateAccountSheet';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { MainMenuDots } from '@/features/navigation/ui/MainMenuDots';
import { PremiumUpgradeSheet } from '@/features/premium/ui/PremiumUpgradeSheet';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';

import AccountsPage from '@/pages/accounts/AccountsPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const goBack = useNavigationStore((state) => state.goBack);

  const isAIMenuOpen = useNavigationStore((state) => state.isAIMenuOpen);
  const isGlobalCommandListOpen = useNavigationStore(
    (state) => state.isGlobalCommandListOpen,
  );

  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIMenu = useNavigationStore((state) => state.openAIMenu);
  const closeAIMenu = useNavigationStore((state) => state.closeAIMenu);
  const openGlobalCommandList = useNavigationStore(
    (state) => state.openGlobalCommandList,
  );
  const closeGlobalCommandList = useNavigationStore(
    (state) => state.closeGlobalCommandList,
  );

  const isCreateAccountOpen = useAccountFlowStore(
    (state) => state.isCreateAccountOpen,
  );
  const closeCreateAccount = useAccountFlowStore(
    (state) => state.closeCreateAccount,
  );

  const createAccount = useAccountsStore((state) => state.createAccount);

  useSwipeNavigation({
    currentScreen,
    navigateTo,
  });

  const runGlobalCommand = (command: string) => {
    const normalized = command.trim().toLowerCase();

    if (
      normalized.includes('дашборд') ||
      normalized.includes('главн') ||
      normalized.includes('сводк')
    ) {
      navigateTo('dashboard');
      return;
    }

    if (
      normalized.includes('сч') ||
      normalized.includes('баланс') ||
      normalized.includes('карт')
    ) {
      navigateTo('accounts');
      return;
    }

    if (
      normalized.includes('транзак') ||
      normalized.includes('операц') ||
      normalized.includes('истори') ||
      normalized.includes('расход') ||
      normalized.includes('доход')
    ) {
      navigateTo('transactions');
      return;
    }

    if (
      normalized.includes('настрой') ||
      normalized.includes('профиль') ||
      normalized.includes('подписк')
    ) {
      navigateTo('settings');
      return;
    }

    navigateTo('ai-core');
  };

  const isMainScreen =
    currentScreen === 'dashboard' ||
    currentScreen === 'ai-core' ||
    currentScreen === 'settings';

  return (
    <div className="telegram-app-shell">
      <div className="telegram-app-content">
        {currentScreen === 'ai-core' && <AICoreScreen />}
        {currentScreen === 'dashboard' && <DashboardPage onBack={goBack} />}
        {currentScreen === 'accounts' && <AccountsPage onBack={goBack} />}
        {currentScreen === 'transactions' && (
          <TransactionsPage onBack={goBack} />
        )}
        {currentScreen === 'settings' && <SettingsPage onBack={goBack} />}
      </div>

      {isMainScreen ? (
        <MainMenuDots currentScreen={currentScreen} onNavigate={navigateTo} />
      ) : null}

      <AIAssistantDock onOpen={openAIMenu} />

      <AIMenuSheet
        open={isAIMenuOpen}
        onClose={closeAIMenu}
        onOpenAI={() => navigateTo('ai-core')}
        onOpenCommands={openGlobalCommandList}
        onOpenVoice={() => navigateTo('ai-core')}
      />

      <CommandListSheet
        open={isGlobalCommandListOpen}
        onClose={closeGlobalCommandList}
        onRunCommand={runGlobalCommand}
      />

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
    </div>
  );
}