import { useState } from 'react';
import { adminApi } from '@/features/admin/api/admin.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { AdminAccessDenied } from './admin-page/AdminAccessDenied';
import { AdminEventsPanel } from './admin-page/AdminEventsPanel';
import { AdminLoadState } from './admin-page/AdminLoadState';
import { AdminMonitoringPanel } from './admin-page/AdminMonitoringPanel';
import { AdminOverviewPanel } from './admin-page/AdminOverviewPanel';
import { AdminTabs } from './admin-page/AdminTabs';
import { AdminToolsPanel } from './admin-page/AdminToolsPanel';
import { AdminTrainingPanel } from './admin-page/AdminTrainingPanel';
import { AdminUsersPanel } from './admin-page/AdminUsersPanel';
import type { AdminTab } from './admin-page/adminPage.types';
import { useAdminDashboardData } from './admin-page/useAdminDashboardData';
import { useAdminTraining } from './admin-page/useAdminTraining';

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [subscriptionBusy, setSubscriptionBusy] = useState<string | null>(null);
  const [subscriptionDays, setSubscriptionDays] = useState<Record<string, string>>({});
  const [premiumPreviewEnabled, setPremiumPreviewEnabled] = useState(() => localStorage.getItem('ai-financer-premium-preview') === '1');
  const replayOnboarding = useOnboardingStore((state) => state.reset);

  const isAdmin = Boolean(user?.isAdmin);
  const {
    overview,
    users,
    events,
    isLoading,
    errors,
    reloadUsers,
    reloadOverview,
  } = useAdminDashboardData(isAdmin);
  const {
    trainingExamples,
    trainingDrafts,
    trainingBusyId,
    isTrainingLoading,
    setTrainingDrafts,
    loadTrainingExamples,
    handleSaveTrainingExample,
  } = useAdminTraining(isAdmin, tab);

  if (!isAdmin) return <AdminAccessDenied />;

  const handleSubscriptionDaysChange = (userId: string, value: string) => {
    setSubscriptionDays((state) => ({ ...state, [userId]: value }));
  };

  const togglePremiumPreview = () => {
    const next = !premiumPreviewEnabled;
    setPremiumPreviewEnabled(next);
    localStorage.setItem('ai-financer-premium-preview', next ? '1' : '0');
  };

  const refreshAdminData = async () => {
    await reloadUsers();
    if (overview) await reloadOverview();
  };

  const handleResetUser = async (userId: string, mode: 'finance' | 'full') => {
    const confirmText = mode === 'finance' ? 'RESET FINANCE' : 'RESET FULL';
    const text = mode === 'finance'
      ? `Чтобы очистить финансы пользователя, введи ${confirmText}`
      : `Чтобы полностью обнулить тестера, введи ${confirmText}`;

    if (window.prompt(text) !== confirmText) return;

    setResettingUserId(userId + ':' + mode);
    try {
      await adminApi.resetUser(userId, mode, confirmText);
      await refreshAdminData();
    } finally {
      setResettingUserId(null);
    }
  };

  const handleGrantSubscription = async (userId: string, product: 'premium' | 'business', lifetime = false) => {
    const days = Number(subscriptionDays[userId] || '30');
    setSubscriptionBusy(`${userId}:${product}:${lifetime ? 'forever' : 'days'}`);
    try {
      if (lifetime) await adminApi.grantLifetimeSubscription(userId, product);
      else await adminApi.grantSubscription(userId, product, Number.isFinite(days) ? days : 30);
      await refreshAdminData();
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const handleRevokeSubscription = async (userId: string, product: 'premium' | 'business') => {
    setSubscriptionBusy(`${userId}:${product}:revoke`);
    try {
      await adminApi.revokeSubscription(userId, product);
      await refreshAdminData();
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const handleRestartTrial = async (userId: string) => {
    setSubscriptionBusy(`${userId}:trial`);
    try {
      await adminApi.restartTrial(userId);
      await reloadUsers();
    } finally {
      setSubscriptionBusy(null);
    }
  };

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Админ" left="back" right={['home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Закрытый раздел</div>
          <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.05em]">Админ-панель</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">Пользователи, события, воронка и состояние сервиса.</p>
        </header>

        <AdminTabs activeTab={tab} onChange={setTab} />
        <AdminLoadState isLoading={isLoading} errors={errors} />

        {tab === 'overview' && overview ? <AdminOverviewPanel overview={overview} /> : null}

        {tab === 'users' ? (
          <AdminUsersPanel
            users={users}
            resettingUserId={resettingUserId}
            subscriptionBusy={subscriptionBusy}
            subscriptionDays={subscriptionDays}
            onSubscriptionDaysChange={handleSubscriptionDaysChange}
            onResetUser={(userId, mode) => void handleResetUser(userId, mode)}
            onGrantSubscription={(userId, product, lifetime) => void handleGrantSubscription(userId, product, lifetime)}
            onRevokeSubscription={(userId, product) => void handleRevokeSubscription(userId, product)}
            onRestartTrial={(userId) => void handleRestartTrial(userId)}
          />
        ) : null}

        {tab === 'events' ? <AdminEventsPanel events={events} /> : null}

        {tab === 'training' ? (
          <AdminTrainingPanel
            trainingExamples={trainingExamples}
            trainingDrafts={trainingDrafts}
            trainingBusyId={trainingBusyId}
            isTrainingLoading={isTrainingLoading}
            setTrainingDrafts={setTrainingDrafts}
            onReload={() => void loadTrainingExamples()}
            onSave={(exampleId, success) => void handleSaveTrainingExample(exampleId, success)}
          />
        ) : null}

        {tab === 'tools' ? (
          <AdminToolsPanel
            premiumPreviewEnabled={premiumPreviewEnabled}
            onReplayOnboarding={replayOnboarding}
            onTogglePremiumPreview={togglePremiumPreview}
          />
        ) : null}

        {tab === 'monitoring' && overview?.monitoring ? <AdminMonitoringPanel monitoring={overview.monitoring} /> : null}
      </div>
    </div>
  );
}
