import { create } from 'zustand';
import type { AccountType } from '@/features/accounts/model/accountFlow.types';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { GoalDto } from '@/features/goals/api/goals.api';
import type { LoanDto, LoanType } from '@/features/obligations/api/obligations.api';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import type { ReportMode } from '@/features/reports/api/reports.api';
import type { StoreCard } from '@/features/store/model/storeCatalog';
import type { PremiumTrigger } from '@/features/premium/model/premium.types';
import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';

export type AppModalDescriptor =
  | { type: 'account-create'; prefill?: Partial<{ name: string; type: AccountType; currency: 'RUB' | 'USD' | 'EUR'; initialBalance: string }> }
  | { type: 'account-details'; accountId: string }
  | { type: 'account-edit'; account: AccountDto }
  | { type: 'account-transfer'; fromAccountId: string }
  | { type: 'transaction-create'; initialType?: 'expense' | 'income' | 'transfer' }
  | { type: 'transaction-edit'; transaction: TransactionDto }
  | { type: 'category-edit'; category?: CategoryDto | null; sectionId?: string | null; initialType?: 'expense' | 'income' | 'both'; prefillName?: string | null; onSavedCategory?: (category: CategoryDto) => void }
  | { type: 'section-edit'; section?: SectionDto | null }
  | { type: 'goal-edit'; goal?: GoalDto | null; onAfterSave?: () => void }
  | { type: 'obligation-edit'; loan?: LoanDto | null; initialType?: LoanType | null }
  | { type: 'notifications' }
  | { type: 'trial-offer'; source?: 'tour_complete' | 'tour_skip' | 'store' | 'premium' | 'manual' }
  | { type: 'store-limits' }
  | { type: 'store-payment'; product: StoreCard }
  | { type: 'premium-upgrade'; trigger: PremiumTrigger }
  | { type: 'receipt-premium-lock' }
  | { type: 'receipt-review'; scanId: string; initialScan?: ReceiptScanDto }
  | { type: 'report-export'; mode?: ReportMode }
  | { type: 'ai-text-overlay'; initialCommand?: string | null; initialAssistantMessage?: string | null; mode?: 'text' | 'voice'; autoStartVoice?: boolean; autoCloseOnVoiceResult?: boolean; autoSubmitInitialCommand?: boolean }
  | { type: 'home-chart-details'; mode: HomeCashflowMode; period: HomeCashflowPeriod }
  | { type: 'home-category-operations'; group: HomeFinanceGroup }
  | { type: 'accounts-tools' }
  | { type: 'taxonomy-tools' }
  | { type: 'taxonomy-section'; section: SectionDto | 'ungrouped' };

const SINGLETON_MODAL_TYPES = new Set<AppModalDescriptor['type']>([
  'ai-text-overlay',
  'store-limits',
  'store-payment',
  'premium-upgrade',
  'receipt-premium-lock',
  'receipt-review',
  'notifications',
  'trial-offer',
]);

type AppModalState = {
  stack: AppModalDescriptor[];
  openModal: (modal: AppModalDescriptor) => void;
  replaceModal: (modal: AppModalDescriptor) => void;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  closeTopModal: () => void;
  closeAllModals: () => void;
};

export const useAppModalStore = create<AppModalState>((set, get) => ({
  stack: [],

  openModal: (modal) => set((state) => {
    if (SINGLETON_MODAL_TYPES.has(modal.type)) {
      return { stack: [...state.stack.filter((item) => item.type !== modal.type), modal] };
    }
    return { stack: [...state.stack, modal] };
  }),

  replaceModal: (modal) => set((state) => ({ stack: [...state.stack.slice(0, -1), modal] })),

  closeModal: (type) => {
    if (!type) {
      get().closeTopModal();
      return;
    }
    set((state) => ({ stack: state.stack.filter((modal) => modal.type !== type) }));
  },

  closeTopModal: () => set((state) => ({ stack: state.stack.slice(0, -1) })),

  closeAllModals: () => set({ stack: [] }),
}));
