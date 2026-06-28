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
  const [userSearchQuery, setUserSearchQuery] = useState('');
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

  const refreshAdminData = async () => {
    await reloadUsers(userSearchQuery);
    if (overview) await reloadOverview();
  };

  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    await reloadUsers(query);
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


  return (
    <div className="app-page admin-page text-white">
      <div className="app-page__inner admin-layout">
        <ScreenTopBar title="Админ" left="back" right={['home']} />

        <header className="app-card app-card--hero admin-hero">
          <div className="app-eyebrow">Закрытый раздел</div>
          <h1>Админ-панель</h1>
          <p>Пользователи, события, воронка и состояние сервиса.</p>
        </header>

        <AdminTabs activeTab={tab} onChange={setTab} />
        <AdminLoadState isLoading={isLoading} errors={errors} />

        {tab === 'overview' && overview ? <AdminOverviewPanel overview={overview} /> : null}

        {tab === 'users' ? (
          <AdminUsersPanel
            users={users}
            resettingUserId={resettingUserId}
            searchQuery={userSearchQuery}
            onSearch={(query) => void handleSearchUsers(query)}
            onResetUser={(userId, mode) => void handleResetUser(userId, mode)}
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
            onReplayOnboarding={replayOnboarding}
          />
        ) : null}

        {tab === 'monitoring' && overview?.monitoring ? <AdminMonitoringPanel monitoring={overview.monitoring} /> : null}
      </div>
    </div>
  );
}
