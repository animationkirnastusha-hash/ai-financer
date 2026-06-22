import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

const ACCOUNT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['account-create', 'account-details', 'account-transfer', 'account-edit']);
const FINANCE_ENTITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['transaction-create', 'transaction-edit', 'category-edit', 'section-edit', 'goal-edit']);
const HOME_FINANCE_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['home-chart-details', 'home-category-operations']);
const OBLIGATION_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['obligation-edit']);
const NOTIFICATION_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['notifications']);
const REPORT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['report-export']);
const STORE_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['store-limits', 'store-payment']);
const PREMIUM_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['premium-upgrade']);
const RECEIPT_LOCK_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['receipt-premium-lock']);
const TEXT_CHAT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['ai-text-overlay']);
const TRIAL_OFFER_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['trial-offer']);
const UTILITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['accounts-tools', 'taxonomy-tools', 'taxonomy-section']);

export function isAccountModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'account-create' | 'account-details' | 'account-transfer' | 'account-edit' }> {
  return ACCOUNT_MODAL_TYPES.has(modal.type);
}

export function isFinanceEntityModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'transaction-create' | 'transaction-edit' | 'category-edit' | 'section-edit' | 'goal-edit' }> {
  return FINANCE_ENTITY_MODAL_TYPES.has(modal.type);
}

export function isHomeFinanceModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'home-chart-details' | 'home-category-operations' }> {
  return HOME_FINANCE_MODAL_TYPES.has(modal.type);
}

export function isObligationModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'obligation-edit' }> {
  return OBLIGATION_MODAL_TYPES.has(modal.type);
}

export function isUtilityModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'accounts-tools' | 'taxonomy-tools' | 'taxonomy-section' }> {
  return UTILITY_MODAL_TYPES.has(modal.type);
}

export function isNotificationModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'notifications' }> {
  return NOTIFICATION_MODAL_TYPES.has(modal.type);
}

export function isReportModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'report-export' }> {
  return REPORT_MODAL_TYPES.has(modal.type);
}

export function isTextChatModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'ai-text-overlay' }> {
  return TEXT_CHAT_MODAL_TYPES.has(modal.type);
}

export function isTrialOfferModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'trial-offer' }> {
  return TRIAL_OFFER_MODAL_TYPES.has(modal.type);
}


export function isStoreModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'store-limits' | 'store-payment' }> {
  return STORE_MODAL_TYPES.has(modal.type);
}

export function isPremiumModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'premium-upgrade' }> {
  return PREMIUM_MODAL_TYPES.has(modal.type);
}

export function isReceiptLockModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'receipt-premium-lock' }> {
  return RECEIPT_LOCK_MODAL_TYPES.has(modal.type);
}
