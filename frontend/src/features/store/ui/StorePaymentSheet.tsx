import type { StorePaymentProduct } from '@/features/payments/api/payments.api';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import type { StoreCard } from '@/features/store/model/storeCatalog';
import { Drawer } from '@/shared/ui/Drawer';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  open: boolean;
  product: StoreCard | null;
  onClose: () => void;
};

function getPaymentProduct(product: StoreCard | null): StorePaymentProduct {
  return product?.tone === 'business' ? 'business' : 'premium';
}

export function StorePaymentSheet({ open, product, onClose }: Props) {
  const { t } = useI18n();
  const paymentProduct = getPaymentProduct(product);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={product ? t(product.title) : t('store.payment.title')}
      subtitle={t('store.payment.sheetSubtitle')}
      className="store-payment-sheet"
      bodyClassName="store-payment-sheet__body"
    >
      {product ? (
        <div className="store-payment-sheet__intro">
          <span>{t(product.eyebrow)}</span>
          <p>{t(product.caption)}</p>
        </div>
      ) : null}
      <StorePaymentActions product={paymentProduct} />
    </Drawer>
  );
}
