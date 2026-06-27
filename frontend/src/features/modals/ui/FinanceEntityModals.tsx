import { CategoryEditSheet } from '@/features/sections/ui/CategoryEditSheet';
import { SectionEditSheet } from '@/features/sections/ui/SectionEditSheet';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import { TransactionCreateSheet } from '@/features/transactions/ui/TransactionCreateSheet';
import { TransactionEditSheet } from '@/features/transactions/ui/TransactionEditSheet';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import type { DeleteTransactionBalanceMode, TransactionDto } from '@/features/transactions/api/transactions.api';

type FinanceModal = Extract<
  AppModalDescriptor,
  { type: 'transaction-create' | 'transaction-edit' | 'category-edit' | 'section-edit' }
>;

type Props = {
  modal: FinanceModal;
  layer: number;
  sections: SectionDto[];
  isTransactionSaving: boolean;
  isCreatingTaxonomy: boolean;
  isTaxonomySaving: boolean;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  refreshFinance: () => Promise<void>;
  createTransaction: (payload: any) => Promise<unknown>;
  updateTransaction: (id: string, payload: any) => Promise<unknown>;
  deleteTransaction: (transaction: TransactionDto, balanceMode?: DeleteTransactionBalanceMode) => Promise<unknown>;
  createSection: (payload: any) => Promise<unknown>;
  updateSection: (id: string, payload: any) => Promise<unknown>;
  deleteSection: (id: string) => Promise<unknown>;
  createCategory: (payload: any) => Promise<CategoryDto>;
  updateCategory: (id: string, payload: any) => Promise<CategoryDto>;
  deleteCategory: (id: string) => Promise<unknown>;
  loadTaxonomy: (force?: boolean) => Promise<unknown>;
};

export function FinanceEntityModals({
  modal,
  layer,
  sections,
  isTransactionSaving,
  isCreatingTaxonomy,
  isTaxonomySaving,
  closeModal,
  refreshFinance,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createSection,
  updateSection,
  deleteSection,
  createCategory,
  updateCategory,
  deleteCategory,
  loadTaxonomy,
}: Props) {
  switch (modal.type) {
    case 'transaction-create':
      return (
        <TransactionCreateSheet
          open
          initialType={modal.initialType}
          isSaving={isTransactionSaving}
          modalLayer={layer}
          onClose={() => closeModal('transaction-create')}
          onSave={async (payload) => {
            closeModal('transaction-create');
            await createTransaction(payload);
            await refreshFinance();
          }}
        />
      );
    case 'transaction-edit':
      return (
        <TransactionEditSheet
          open
          transaction={modal.transaction}
          isSaving={isTransactionSaving}
          modalLayer={layer}
          onClose={() => closeModal('transaction-edit')}
          onSave={async (payload) => {
            closeModal('transaction-edit');
            await updateTransaction(modal.transaction.id, payload);
            await refreshFinance();
          }}
          onDelete={async (transaction, balanceMode) => {
            closeModal('transaction-edit');
            await deleteTransaction(transaction, balanceMode);
            await refreshFinance();
          }}
        />
      );
    case 'category-edit':
      return (
        <CategoryEditSheet
          open
          category={modal.category ?? null}
          sections={sections}
          initialType={modal.initialType}
          initialName={modal.prefillName ?? null}
          initialSectionId={modal.sectionId ?? null}
          isSaving={isCreatingTaxonomy || isTaxonomySaving}
          modalLayer={layer}
          onClose={() => closeModal('category-edit')}
          onSave={async (payload) => {
            const saved = modal.category
              ? await updateCategory(modal.category.id, payload)
              : await createCategory({ ...payload, sectionId: payload.sectionId ?? modal.sectionId ?? null });
            modal.onSavedCategory?.(saved);
            closeModal('category-edit');
            await loadTaxonomy(true);
          }}
          onDelete={async (category) => {
            await deleteCategory(category.id);
            closeModal('category-edit');
            await loadTaxonomy(true);
          }}
        />
      );
    case 'section-edit':
      return (
        <SectionEditSheet
          open
          section={modal.section ?? null}
          isSaving={isCreatingTaxonomy || isTaxonomySaving}
          modalLayer={layer}
          onClose={() => closeModal('section-edit')}
          onSave={async (payload) => {
            if (modal.section) await updateSection(modal.section.id, payload);
            else await createSection(payload);
            closeModal('section-edit');
            await loadTaxonomy(true);
          }}
          onDelete={async (section) => {
            await deleteSection(section.id);
            closeModal('section-edit');
            await loadTaxonomy(true);
          }}
        />
      );
    default:
      return null;
  }
}
