import type { StoreCard } from '@/features/store/model/storeCatalog';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  card: StoreCard;
  hasPremium: boolean;
  hasBusiness: boolean;
  onBuy: (card: StoreCard) => void;
};

function hasAccess(card: StoreCard, hasPremium: boolean, hasBusiness: boolean) {
  if (card.comingSoon) return false;
  if (card.product === 'business') return hasBusiness;
  if (card.product === 'premium') return hasPremium;
  return false;
}

export function StoreProductDetail({ card, hasPremium, hasBusiness, onBuy }: Props) {
  const { t } = useI18n();
  const access = hasAccess(card, hasPremium, hasBusiness);
  const blocked = Boolean(card.comingSoon);

  return (
    <section className="app-card store-product-detail-card">
      <div className="store-product-detail-card__head">
        <div>
          <span className="app-eyebrow">{t(card.eyebrow)}</span>
          <h2>{t(card.title)}</h2>
        </div>
        <strong>{blocked ? t('store.status.soon') : access ? t('store.status.active') : t(card.price)}</strong>
      </div>
      <p>{t(card.caption)}</p>
      <ul>
        {card.items.map((item) => <li key={item}>{t(item)}</li>)}
      </ul>
      <button type="button" className="app-primary-button" disabled={access || blocked} onClick={() => onBuy(card)}>
        {blocked ? t('store.action.businessSoon') : access ? t('store.status.active') : t(card.action)}
      </button>
    </section>
  );
}
