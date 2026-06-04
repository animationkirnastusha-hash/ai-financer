import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

export function pickModal<T extends AppModalDescriptor['type']>(stack: AppModalDescriptor[], type: T) {
  return [...stack].reverse().find((modal): modal is Extract<AppModalDescriptor, { type: T }> => modal.type === type) ?? null;
}

export function layerByIndex(index: number) {
  return 420 + index * 30;
}
