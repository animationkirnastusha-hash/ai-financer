import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import type { StoreCard } from '@/features/store/model/storeCatalog';
import { Drawer } from '@/shared/ui/Drawer';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  open: boolean;
  product: StoreCard | null;
  onClose: () => void;
  layer?: number;
};

export function StorePaymentSheet({ open, product, onClose, layer }: Props) {
  const { t } = useI18n();
  const paymentProduct = product?.comingSoon ? null : product?.product;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={product ? t(product.title) : t('store.payment.title')}
      subtitle={t('store.payment.sheetSubtitle')}
      className="store-payment-sheet"
      bodyClassName="store-payment-sheet__body"
      layer={layer}
    >
      {product ? (
        <div className="store-payment-sheet__intro">
          <span>{t(product.eyebrow)}</span>
          <p>{t(product.caption)}</p>
        </div>
      ) : null}
      {product?.comingSoon ? (
        <div className="store-payment-sheet__intro">
          <span>{t('store.status.soon')}</span>
          <p>{t('store.business.soonPaymentCaption')}</p>
        </div>
      ) : paymentProduct ? <StorePaymentActions product={paymentProduct} /> : null}
    </Drawer>
  );
}
