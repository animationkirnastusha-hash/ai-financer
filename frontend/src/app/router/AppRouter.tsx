import { AICoreScreen } from '@/features/ai-core/ui/AICoreScreen';
import { AIAssistantDock } from '@/features/ai-core/ui/AIAssistantDock';
import { AIMenuSheet } from '@/features/ai-core/ui/AIMenuSheet';
import { CreateAccountSheet } from '@/features/accounts/ui/CreateAccountSheet';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSwipeNavigation } from '@/features/navigation/lib/useSwipeNavigation';
import { MainMenuDots, SETTINGS_FLOW_ITEMS } from '@/features/navigation/ui/MainMenuDots';
import { AppTopActions } from '@/features/navigation/ui/AppTopActions';
import { PremiumUpgradeSheet } from '@/features/premium/ui/PremiumUpgradeSheet';
import { LaunchOnboardingSheet } from '@/features/onboarding/ui/LaunchOnboardingSheet';

import AccountsPage from '@/pages/accounts/AccountsPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import TaxonomySettingsPage from '@/pages/settings/TaxonomySettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import SectionsPage from '@/pages/sections/SectionsPage';

export function AppRouter() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const goBack = useNavigationStore((state) => state.goBack);

  const isAIMenuOpen = useNavigationStore((state) => state.isAIMenuOpen);
  const isGlobalCommandListOpen = useNavigationStore((state) => state.isGlobalCommandListOpen);

  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIMenu = useNavigationStore((state) => state.openAIMenu);
  const closeAIMenu = useNavigationStore((state) => state.closeAIMenu);
  const openGlobalCommandList = useNavigationStore((state) => state.openGlobalCommandList);
  const closeGlobalCommandList = useNavigationStore((state) => state.closeGlobalCommandList);

  const isCreateAccountOpen = useAccountFlowStore((state) => state.isCreateAccountOpen);
  const closeCreateAccount = useAccountFlowStore((state) => state.closeCreateAccount);

  const createAccount = useAccountsStore((state) => state.createAccount);

  useSwipeNavigation({
    currentScreen,
    navigateTo,
    goBack,
  });

  const runGlobalCommand = (command: string) => {
    const normalized = command.trim().toLowerCase();

    if (normalized.includes('главн') || normalized.includes('core') || normalized.includes('ai')) {
      navigateTo('ai-core');
      return;
    }

    if (normalized.includes('дашборд') || normalized.includes('сводк')) {
      navigateTo('dashboard');
      return;
    }

    if (normalized.includes('сч') || normalized.includes('баланс') || normalized.includes('карт')) {
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
      normalized.includes('раздел') ||
      normalized.includes('категор') ||
      normalized.includes('папк') ||
      normalized.includes('групп')
    ) {
      navigateTo('taxonomy-settings');
      return;
    }

    if (normalized.includes('настрой') || normalized.includes('профиль') || normalized.includes('подписк')) {
      navigateTo('settings');
      return;
    }

    navigateTo('ai-core');
  };

  const isMainScreen = currentScreen === 'dashboard' || currentScreen === 'ai-core' || currentScreen === 'accounts';
  const isSettingsFlowScreen = currentScreen === 'taxonomy-settings';

  return (
    <div className="telegram-app-shell">
      <div key={currentScreen} className="telegram-app-content ai-screen-transition">
        {currentScreen === 'ai-core' && <AICoreScreen />}
        {currentScreen === 'dashboard' && <DashboardPage />}
        {currentScreen === 'accounts' && <AccountsPage />}
        {currentScreen === 'transactions' && <TransactionsPage onBack={goBack} />}
        {currentScreen === 'sections' && <SectionsPage onBack={goBack} />}
        {currentScreen === 'settings' && <SettingsPage />}
        {currentScreen === 'taxonomy-settings' && <TaxonomySettingsPage />}
      </div>

      <AppTopActions />

      {isMainScreen ? (
        <MainMenuDots currentScreen={currentScreen} onNavigate={navigateTo} bottomOffset={currentScreen === 'ai-core' ? 28 : 72} />
      ) : null}

      {isSettingsFlowScreen ? (
        <MainMenuDots currentScreen={currentScreen} onNavigate={navigateTo} items={SETTINGS_FLOW_ITEMS} bottomOffset={34} />
      ) : null}

      {currentScreen !== 'ai-core' ? <AIAssistantDock onOpen={openAIMenu} /> : null}

      <AIMenuSheet
        open={isAIMenuOpen}
        onClose={closeAIMenu}
        onOpenAI={() => navigateTo('ai-core')}
        onOpenCommands={openGlobalCommandList}
        onOpenVoice={() => navigateTo('ai-core')}
      />

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
    </div>
  );
}
