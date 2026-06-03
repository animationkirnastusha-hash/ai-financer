import { useState } from 'react';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { TransactionCreateSheet } from '@/features/transactions/ui/TransactionCreateSheet';
import { TransactionEditSheet } from '@/features/transactions/ui/TransactionEditSheet';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { HomeChartDetailsModal } from '@/features/dashboard/ui/HomeChartDetailsModal';
import { HomeCategoryOperationsModal } from '@/features/dashboard/ui/HomeCategoryOperationsModal';

type Props = {
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: { usd: number; eur: number };
  isCreateOpen: boolean;
  isDetailsOpen: boolean;
  onCloseCreate: () => void;
  onCloseDetails: () => void;
  onOpenAnalytics: () => void;
};

export function HomeFinanceModalManager({
  transactions,
  mode,
  period,
  rates,
  isCreateOpen,
  isDetailsOpen,
  onCloseCreate,
  onCloseDetails,
  onOpenAnalytics,
}: Props) {
  const [activeGroup, setActiveGroup] = useState<HomeFinanceGroup | null>(null);
  const editing = useTransactionsStore((state) => state.editing);
  const isMutating = useTransactionsStore((state) => state.isMutating);
  const openEdit = useTransactionsStore((state) => state.openEdit);
  const closeEdit = useTransactionsStore((state) => state.closeEdit);
  const saveEdit = useTransactionsStore((state) => state.saveEdit);
  const createItem = useTransactionsStore((state) => state.createItem);
  const deleteItem = useTransactionsStore((state) => state.deleteItem);

  return (
    <>
      <TransactionCreateSheet
        open={isCreateOpen}
        isSaving={isMutating}
        onClose={onCloseCreate}
        onSave={async (payload) => {
          await createItem(payload);
          onCloseCreate();
        }}
      />

      <HomeChartDetailsModal
        open={isDetailsOpen}
        transactions={transactions}
        mode={mode}
        period={period}
        rates={rates}
        onClose={onCloseDetails}
        onOpenAnalytics={onOpenAnalytics}
        onOpenGroup={setActiveGroup}
      />

      <HomeCategoryOperationsModal
        group={activeGroup}
        onClose={() => setActiveGroup(null)}
        onEdit={(transaction) => {
          setActiveGroup(null);
          openEdit(transaction);
        }}
      />

      <TransactionEditSheet
        open={Boolean(editing)}
        transaction={editing}
        isSaving={isMutating}
        onClose={closeEdit}
        onSave={saveEdit}
        onDelete={async (transaction) => {
          await deleteItem(transaction);
          closeEdit();
        }}
      />
    </>
  );
}
