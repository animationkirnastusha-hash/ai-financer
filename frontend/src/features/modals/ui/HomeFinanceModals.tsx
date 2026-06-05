import { buildHomeFinanceAnalytics } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { HomeCategoryOperationsModal } from '@/features/dashboard/ui/HomeCategoryOperationsModal';
import { HomeChartDetailsModal } from '@/features/dashboard/ui/HomeChartDetailsModal';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { pickModal } from '@/features/modals/lib/modalLayers';

type HomeModal = Extract<AppModalDescriptor, { type: 'home-chart-details' | 'home-category-operations' }>;

type Rates = {
  usd: number;
  eur: number;
};

type Props = {
  modal: HomeModal;
  layer: number;
  stack: AppModalDescriptor[];
  transactions: TransactionDto[];
  rates: Rates;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  closeAllModals: () => void;
  openModal: (modal: AppModalDescriptor) => void;
  openAnalytics: () => void;
  openAnalyticsReport?: () => void;
};

export function HomeFinanceModals({
  modal,
  layer,
  stack,
  transactions,
  rates,
  closeModal,
  closeAllModals,
  openModal,
  openAnalytics,
  openAnalyticsReport,
}: Props) {
  switch (modal.type) {
    case 'home-chart-details':
      return (
        <HomeChartDetailsModal
          open
          transactions={transactions}
          mode={modal.mode}
          period={modal.period}
          rates={rates}
          modalLayer={layer}
          onClose={() => closeModal('home-chart-details')}
          onOpenAnalytics={() => {
            closeAllModals();
            openAnalytics();
          }}
          onOpenReport={() => {
            if (openAnalyticsReport) {
              openAnalyticsReport();
              return;
            }
            closeAllModals();
            openAnalytics();
            openModal({ type: 'report-export', mode: 'base' });
          }}
          onOpenGroup={(group) => openModal({ type: 'home-category-operations', group })}
        />
      );
    case 'home-category-operations': {
      const activeDetails = pickModal(stack, 'home-chart-details');
      const currentGroup = activeDetails
        ? buildHomeFinanceAnalytics(transactions, activeDetails.mode, activeDetails.period, rates).categories.find((group) => group.key === modal.group.key) ?? null
        : modal.group;
      return (
        <HomeCategoryOperationsModal
          group={currentGroup}
          modalLayer={layer}
          onClose={() => closeModal('home-category-operations')}
          onEdit={(transaction) => openModal({ type: 'transaction-edit', transaction })}
        />
      );
    }
    default:
      return null;
  }
}
