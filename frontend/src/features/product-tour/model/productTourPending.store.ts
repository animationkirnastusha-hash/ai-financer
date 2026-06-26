export const PRODUCT_TOUR_PENDING_STORAGE_KEY = 'ai-financer-product-tour-pending:v1';

export function markProductTourPending() {
  localStorage.setItem(PRODUCT_TOUR_PENDING_STORAGE_KEY, 'true');
  window.dispatchEvent(new CustomEvent('ai-financer:product-tour-pending'));
}

export function consumeProductTourPending() {
  const isPending = localStorage.getItem(PRODUCT_TOUR_PENDING_STORAGE_KEY) === 'true';
  if (isPending) localStorage.removeItem(PRODUCT_TOUR_PENDING_STORAGE_KEY);
  return isPending;
}
