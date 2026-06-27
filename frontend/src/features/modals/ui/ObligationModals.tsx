import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

// Legacy payment form renderer is intentionally disconnected.
// Payment creation/editing now starts in the Fina chat overlay from the Payments page.
type Props = {
  modal: AppModalDescriptor;
};

export function ObligationModals({ modal: _modal }: Props) {
  return null;
}
