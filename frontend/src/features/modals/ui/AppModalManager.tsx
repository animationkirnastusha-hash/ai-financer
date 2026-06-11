import { Fragment } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { AppModalBodyLock } from '@/features/modals/ui/AppModalBodyLock';
import { AppModalRenderer } from '@/features/modals/ui/app-modal-manager/AppModalRenderer';
import { useAppModalDependencies } from '@/features/modals/ui/app-modal-manager/useAppModalDependencies';
import { useAppModalHydration } from '@/features/modals/ui/app-modal-manager/useAppModalHydration';
import { useTextChatModalEvent } from '@/features/modals/ui/app-modal-manager/useTextChatModalEvent';

export function AppModalManager() {
  const stack = useAppModalStore((state) => state.stack);
  const openModal = useAppModalStore((state) => state.openModal);
  const closeModal = useAppModalStore((state) => state.closeModal);
  const closeAllModals = useAppModalStore((state) => state.closeAllModals);
  const deps = useAppModalDependencies();

  useTextChatModalEvent(openModal);
  useAppModalHydration(stack, deps);

  return (
    <>
      <AppModalBodyLock active={stack.length > 0} />
      {stack.map((modal, index) => (
        <Fragment key={`${modal.type}-${index}`}>
          <AppModalRenderer
            modal={modal}
            index={index}
            stack={stack}
            deps={deps}
            openModal={openModal}
            closeModal={closeModal}
            closeAllModals={closeAllModals}
          />
        </Fragment>
      ))}
    </>
  );
}
