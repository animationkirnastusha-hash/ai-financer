import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

const ACCOUNT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['account-details', 'account-edit']);
const FINANCE_ENTITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['transaction-create', 'transaction-edit', 'category-edit', 'section-edit']);
const HOME_FINANCE_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['home-chart-details', 'home-category-operations']);
const NOTIFICATION_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['notifications']);
const REPORT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['report-export']);
const TEXT_CHAT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['ai-text-overlay']);
const UTILITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['accounts-tools', 'taxonomy-tools', 'taxonomy-section']);

export function isAccountModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'account-details' | 'account-edit' }> {
  return ACCOUNT_MODAL_TYPES.has(modal.type);
}

export function isFinanceEntityModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'transaction-create' | 'transaction-edit' | 'category-edit' | 'section-edit' }> {
  return FINANCE_ENTITY_MODAL_TYPES.has(modal.type);
}

export function isHomeFinanceModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'home-chart-details' | 'home-category-operations' }> {
  return HOME_FINANCE_MODAL_TYPES.has(modal.type);
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






