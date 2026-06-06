import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { paymentsApi, type StorePaymentCatalogDto, type StorePaymentDuration, type StorePaymentProduct, type StorePaymentProvider } from '@/features/payments/api/payments.api';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  product: StorePaymentProduct;
  title?: string;
  compact?: boolean;
};

function formatPrice(amount: number, currency: string) {
  if (currency === 'XTR') return `${amount} Stars`;
  if (currency === 'RUB') return `${Math.round(amount / 100).toLocaleString('ru-RU')} ₽`;
  return `${amount} ${currency}`;
}

function findOptions(catalog: StorePaymentCatalogDto | null, product: StorePaymentProduct) {
  return catalog?.products.find((item) => item.product === product)?.options ?? [];
}

export function StorePaymentActions({ product, title, compact = false }: Props) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const setSubscription = useSubscriptionStore((state) => state.setStatus);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const [catalog, setCatalog] = useState<StorePaymentCatalogDto | null>(null);
  const [duration, setDuration] = useState<StorePaymentDuration>('month');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  const selectedPrice = selected ? formatPrice(selected.amount, selected.currency) : '—';
  const selectedStarsPrice = selected ? formatPrice(selected.starsAmount, selected.starsCurrency) : '—';

  const createOrder = async (provider: StorePaymentProvider) => {
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await paymentsApi.createOrder({ product, duration, provider });
      if (provider === 'mock') {
        const completed = await paymentsApi.completeMock(result.order.id);
        setSubscription(completed.subscription);
        setMessage(t('store.payment.testGranted'));
        return;
      }
      if (provider === 'telegramStars') {
        setMessage(t('store.payment.starsPrepared'));
        return;
      }
      setMessage(t('store.payment.manualPrepared'));
    } catch (error) {
      setMessage(t('store.payment.error'));
    } finally {
      setIsBusy(false);
      void loadSubscription();
    }
  };

  return (
    <div className={compact ? 'store-payment-actions store-payment-actions--compact' : 'store-payment-actions'}>
      {title ? <h3>{title}</h3> : null}

      <div className="store-payment-plan-toggle" role="group" aria-label={t('store.payment.period')}>
        <button
          type="button"
          className={duration === 'month' ? 'is-active' : undefined}
          onClick={() => setDuration('month')}
        >
          <span>{t('store.payment.month')}</span>
          <strong>{selected && duration === 'month' ? selectedPrice : options.find((option) => option.duration === 'month') ? formatPrice(options.find((option) => option.duration === 'month')!.amount, options.find((option) => option.duration === 'month')!.currency) : '—'}</strong>
        </button>
        <button
          type="button"
          className={duration === 'year' ? 'is-active' : undefined}
          onClick={() => setDuration('year')}
        >
          <span>{t('store.payment.year')}</span>
          <strong>{selected && duration === 'year' ? selectedPrice : options.find((option) => option.duration === 'year') ? formatPrice(options.find((option) => option.duration === 'year')!.amount, options.find((option) => option.duration === 'year')!.currency) : '—'}</strong>
        </button>
      </div>

      <div className="store-payment-action-row">
        <button type="button" className="app-primary-button" disabled={isBusy || !selected} onClick={() => createOrder('telegramStars')}>
          {isBusy ? t('store.payment.preparing') : t('store.payment.stars', { price: selectedStarsPrice })}
        </button>
        <button type="button" className="app-secondary-button" disabled={isBusy || !selected} onClick={() => createOrder('manual')}>
          {t('store.payment.other')}
        </button>
      </div>

      {isAdmin ? (
        <button type="button" className="store-payment-test-button" disabled={isBusy || !selected} onClick={() => createOrder('mock')}>
          {t('store.payment.testAccess')}
        </button>
      ) : null}

      {message ? <p className="store-payment-message">{message}</p> : null}
    </div>
  );
}
