import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useI18n } from '@/shared/lib/i18n';
import { Drawer } from '@/shared/ui/Drawer';

type Props = {
  open: boolean;
  layer?: number;
  onClose: () => void;
};

export function ReceiptPremiumLockSheet({ open, layer, onClose }: Props) {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const openStore = () => {
    onClose();
    navigateTo('store');
  };

  return (
    <Drawer
      open={open}
      layer={layer}
      onClose={onClose}
      className="dashboard-receipt-lock__sheet"
      bodyClassName="dashboard-receipt-lock__body"
      footer={(
        <div className="dashboard-receipt-lock__actions">
          <button type="button" className="app-secondary-button" onClick={onClose}>{t('common.close')}</button>
          <button type="button" className="app-primary-button" onClick={openStore}>{t('dashboard.receipt.lock.store')}</button>
        </div>
      )}
    >
      <div>
        <div className="app-eyebrow">{t('dashboard.receipt.lock.eyebrow')}</div>
        <h2>{t('dashboard.receipt.lock.title')}</h2>
        <p>{t('dashboard.receipt.lock.caption')}</p>
      </div>
    </Drawer>
  );
}
