import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { paymentsApi, type StorePaymentCatalogDto, type StorePaymentDuration, type StorePaymentProduct, type StorePaymentProvider } from '@/features/payments/api/payments.api';
import { formatPaymentPrice } from '@/features/payments/lib/paymentFormat';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { openTelegramExternalLink, openTelegramInvoice } from '@/shared/lib/telegram';
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

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
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
  const selectedRubPrice = selected ? formatPaymentPrice(selected.amount, selected.currency) : '—';
  const selectedRubBasePrice = selected?.baseAmount && selected.baseAmount !== selected.amount
    ? formatPaymentPrice(selected.baseAmount, selected.currency)
    : null;
  const discount = selected?.discountPercent ? t('store.payment.discount', { value: String(selected.discountPercent) }) : null;
  const singleProduct = !isSubscriptionProduct(product);
  const sbpAvailable = Boolean(catalog?.yookassaSbpConfigured);

  if (product === 'business') {
    return (
      <div className={compact ? 'store-payment-actions store-payment-actions--compact' : 'store-payment-actions'}>
        {title ? <h3>{title}</h3> : null}
        <p className="store-payment-message">{t('store.business.soonPaymentCaption')}</p>
      </div>
    );
  }

  const refreshOrder = async (orderId: string, attempts = 1) => {
    let latestStatus = '';
    for (let index = 0; index < attempts; index += 1) {
      await sleep(index === 0 ? 1200 : 3000);
      const order = await paymentsApi.getOrder(orderId).catch(() => null);
      latestStatus = String(order?.status ?? '');
      await loadSubscription();
      if (latestStatus === 'paid') return true;
    }
    return false;
  };

  const openStarsInvoice = async (invoiceLink: string, orderId: string) => {
    const opened = openTelegramInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        setMessage(t('store.payment.starsPaid'));
        void refreshOrder(orderId, 3);
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

  const openExternalCheckout = async (url: string, orderId: string) => {
    const opened = openTelegramExternalLink(url);
    if (!opened) window.open(url, '_blank', 'noopener,noreferrer');
    setMessage(t('store.payment.sbpOpened'));
    void refreshOrder(orderId, 10).then((paid) => {
      if (paid) setMessage(t('store.payment.sbpPaid'));
    });
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
      if (provider === 'yookassaSbp') {
        if (result.checkout.status === 'not_configured') {
          setMessage(t('store.payment.sbpNotConfigured'));
          return;
        }
        const checkoutUrl = result.checkout.checkoutUrl || result.checkout.confirmationUrl || result.order.checkoutUrl;
        if (checkoutUrl) {
          await openExternalCheckout(checkoutUrl, result.order.id);
          return;
        }
        setMessage(t('store.payment.error'));
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
          <strong>{onceOption ? formatPaymentPrice(onceOption.amount, onceOption.currency) : selectedRubPrice}</strong>
        </div>
      ) : (
        <div className="store-payment-plan-toggle" role="group" aria-label={t('store.payment.period')}>
          <button
            type="button"
            className={duration === 'month' ? 'is-active' : undefined}
            onClick={() => setDuration('month')}
          >
            <span>{t('store.payment.month')}</span>
            <strong>{monthOption ? formatPaymentPrice(monthOption.amount, monthOption.currency) : '—'}</strong>
          </button>
          <button
            type="button"
            className={duration === 'year' ? 'is-active' : undefined}
            onClick={() => setDuration('year')}
          >
            <span>{t('store.payment.year')}</span>
            <strong>{yearOption ? formatPaymentPrice(yearOption.amount, yearOption.currency) : '—'}</strong>
            {yearOption ? <small>{t('store.payment.yearHint')}</small> : null}
          </button>
        </div>
      )}

      {selected ? (
        <div className="store-payment-selected-price">
          <span>{t('store.payment.selected')}</span>
          <strong>{selectedRubPrice}</strong>
          {selectedRubBasePrice ? <del>{selectedRubBasePrice}</del> : null}
          {discount ? <em>{discount}</em> : null}
          <small>{t('store.payment.selectedHint')}</small>
        </div>
      ) : null}

      <div className="store-payment-methods" aria-label={t('store.payment.other')}>
        <button type="button" className="store-payment-method is-active" disabled={isBusy || !selected} onClick={() => createOrder('yookassaSbp')}>
          <span>{sbpAvailable ? t('store.payment.sbpAvailable') : t('store.payment.sbpSetupPending')}</span>
          <strong>{isBusy && busyProvider === 'yookassaSbp' ? t('store.payment.preparing') : t('store.payment.sbp')}</strong>
        </button>
        <button type="button" className="store-payment-method" disabled={isBusy || !selected} onClick={() => createOrder('telegramStars')}>
          <span>{t('store.payment.starsAvailable')}</span>
          <strong>{isBusy && busyProvider === 'telegramStars' ? t('store.payment.preparing') : t('store.payment.stars')}</strong>
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
