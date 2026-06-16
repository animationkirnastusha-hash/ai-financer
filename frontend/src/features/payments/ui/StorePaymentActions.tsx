import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { paymentsApi, type StorePaymentCatalogDto, type StorePaymentDuration, type StorePaymentProduct, type StorePaymentProvider } from '@/features/payments/api/payments.api';
import { formatPaymentPrice } from '@/features/payments/lib/paymentFormat';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { openTelegramInvoice } from '@/shared/lib/telegram';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  product: StorePaymentProduct;
  title?: string;
  compact?: boolean;
};

function findOptions(catalog: StorePaymentCatalogDto | null, product: StorePaymentProduct) {
  return catalog?.products.find((item) => item.product === product)?.options ?? [];
}

function getOption(catalog: StorePaymentCatalogDto | null, product: StorePaymentProduct, duration: StorePaymentDuration) {
  return findOptions(catalog, product).find((option) => option.duration === duration) ?? null;
}

function isSubscriptionProduct(product: StorePaymentProduct) {
  return product === 'premium' || product === 'business';
}

export function StorePaymentActions({ product, title, compact = false }: Props) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const setSubscription = useSubscriptionStore((state) => state.setStatus);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const [catalog, setCatalog] = useState<StorePaymentCatalogDto | null>(null);
  const [duration, setDuration] = useState<StorePaymentDuration>(isSubscriptionProduct(product) ? 'month' : 'once');
  const [isBusy, setIsBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<StorePaymentProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDuration(isSubscriptionProduct(product) ? 'month' : 'once');
  }, [product]);

  useEffect(() => {
    let mounted = true;
    paymentsApi.catalog()
      .then((nextCatalog) => {
        if (mounted) setCatalog(nextCatalog);
      })
      .catch(() => {
        if (mounted) setMessage(t('store.payment.error'));
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const options = findOptions(catalog, product);
  const selected = useMemo(() => options.find((option) => option.duration === duration) ?? options[0], [duration, options]);
  const monthOption = getOption(catalog, product, 'month');
  const yearOption = getOption(catalog, product, 'year');
  const onceOption = getOption(catalog, product, 'once');
  const selectedDuration = (selected?.duration ?? duration) as StorePaymentDuration;
  const selectedStarsPrice = selected ? formatPaymentPrice(selected.starsAmount, selected.starsCurrency) : '—';
  const selectedStarsBasePrice = selected?.starsBaseAmount && selected.starsBaseAmount !== selected.starsAmount
    ? formatPaymentPrice(selected.starsBaseAmount, selected.starsCurrency)
    : null;
  const selectedRubHint = selected ? formatPaymentPrice(selected.amount, selected.currency) : '—';
  const discount = selected?.discountPercent ? t('store.payment.discount', { value: String(selected.discountPercent) }) : null;
  const singleProduct = !isSubscriptionProduct(product);

  const refreshOrder = async (orderId: string) => {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    await paymentsApi.getOrder(orderId).catch(() => null);
    await loadSubscription();
  };

  const openStarsInvoice = async (invoiceLink: string, orderId: string) => {
    const opened = openTelegramInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        setMessage(t('store.payment.starsPaid'));
        void refreshOrder(orderId);
        return;
      }
      if (status === 'cancelled') {
        setMessage(t('store.payment.starsCancelled'));
        return;
      }
      if (status === 'failed') {
        setMessage(t('store.payment.starsFailed'));
      }
    });

    if (!opened) {
      window.open(invoiceLink, '_blank', 'noopener,noreferrer');
      setMessage(t('store.payment.starsOpened'));
    }
  };

  const createOrder = async (provider: StorePaymentProvider) => {
    if (isBusy || !selected) return;
    setIsBusy(true);
    setBusyProvider(provider);
    setMessage(null);
    try {
      const result = await paymentsApi.createOrder({ product, duration: selectedDuration, provider });
      if (provider === 'mock') {
        const completed = await paymentsApi.completeMock(result.order.id);
        setSubscription(completed.subscription);
        setMessage(t('store.payment.testGranted'));
        return;
      }
      if (provider === 'telegramStars') {
        if (result.checkout.status === 'not_configured') {
          setMessage(t('store.payment.starsNotConfigured'));
          return;
        }
        if (result.checkout.invoiceLink) {
          setMessage(t('store.payment.starsPrepared'));
          await openStarsInvoice(result.checkout.invoiceLink, result.order.id);
          return;
        }
        setMessage(t('store.payment.error'));
        return;
      }
      setMessage(t('store.payment.manualPrepared'));
    } catch {
      setMessage(t('store.payment.error'));
    } finally {
      setIsBusy(false);
      setBusyProvider(null);
      void loadSubscription();
    }
  };

  return (
    <div className={compact ? 'store-payment-actions store-payment-actions--compact' : 'store-payment-actions'}>
      {title ? <h3>{title}</h3> : null}

      {singleProduct ? (
        <div className="store-payment-one-time">
          <span>{t('store.payment.oneTime')}</span>
          <strong>{onceOption ? formatPaymentPrice(onceOption.starsAmount, onceOption.starsCurrency) : selectedStarsPrice}</strong>
          {onceOption ? <small>{t('store.payment.priceHint', { price: formatPaymentPrice(onceOption.amount, onceOption.currency) })}</small> : null}
        </div>
      ) : (
        <div className="store-payment-plan-toggle" role="group" aria-label={t('store.payment.period')}>
          <button
            type="button"
            className={duration === 'month' ? 'is-active' : undefined}
            onClick={() => setDuration('month')}
          >
            <span>{t('store.payment.month')}</span>
            <strong>{monthOption ? formatPaymentPrice(monthOption.starsAmount, monthOption.starsCurrency) : '—'}</strong>
            {monthOption ? <small>{t('store.payment.priceHint', { price: formatPaymentPrice(monthOption.amount, monthOption.currency) })}</small> : null}
          </button>
          <button
            type="button"
            className={duration === 'year' ? 'is-active' : undefined}
            onClick={() => setDuration('year')}
          >
            <span>{t('store.payment.year')}</span>
            <strong>{yearOption ? formatPaymentPrice(yearOption.starsAmount, yearOption.starsCurrency) : '—'}</strong>
            {yearOption ? <small>{t('store.payment.yearHint', { price: formatPaymentPrice(yearOption.amount, yearOption.currency) })}</small> : null}
          </button>
        </div>
      )}

      {selected ? (
        <div className="store-payment-selected-price">
          <span>{t('store.payment.selected')}</span>
          <strong>{selectedStarsPrice}</strong>
          {selectedStarsBasePrice ? <del>{selectedStarsBasePrice}</del> : null}
          {discount ? <em>{discount}</em> : null}
          <small>{t('store.payment.priceHint', { price: selectedRubHint })}</small>
        </div>
      ) : null}

      <div className="store-payment-methods" aria-label={t('store.payment.other')}>
        <button type="button" className="store-payment-method is-active" disabled={isBusy || !selected} onClick={() => createOrder('telegramStars')}>
          <span>{t('store.payment.starsAvailable')}</span>
          <strong>{isBusy && busyProvider === 'telegramStars' ? t('store.payment.preparing') : t('store.payment.stars', { price: selectedStarsPrice })}</strong>
        </button>
        <button type="button" className="store-payment-method" disabled>
          <span>{t('store.payment.soon')}</span>
          <strong>{t('store.payment.cardsSoon')}</strong>
        </button>
        <button type="button" className="store-payment-method" disabled>
          <span>{t('store.payment.soon')}</span>
          <strong>{t('store.payment.cryptoSoon')}</strong>
        </button>
      </div>

      <p className="store-payment-soon-note">{t('store.payment.soonCaption')}</p>

      {isAdmin ? (
        <button type="button" className="store-payment-admin-access-button" disabled={isBusy || !selected} onClick={() => createOrder('mock')}>
          {isBusy && busyProvider === 'mock' ? t('store.payment.preparing') : t('store.payment.grantAccess')}
        </button>
      ) : null}

      {message ? <p className="store-payment-message">{message}</p> : null}
    </div>
  );
}
