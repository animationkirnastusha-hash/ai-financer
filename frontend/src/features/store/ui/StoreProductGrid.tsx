import type { StoreCard } from '@/features/store/model/storeCatalog';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  cards: StoreCard[];
  activeProductId: string | null;
  hasPremium: boolean;
  hasBusiness: boolean;
  onSelect: (card: StoreCard) => void;
};

function hasAccess(card: StoreCard, hasPremium: boolean, hasBusiness: boolean) {
  if (card.comingSoon) return false;
  if (card.product === 'business') return hasBusiness;
  if (card.product === 'premium') return hasPremium;
  return false;
}

export function StoreProductGrid({ cards, activeProductId, hasPremium, hasBusiness, onSelect }: Props) {
  const { t } = useI18n();

  return (
    <section className="store-product-showcase" aria-label={t('store.showcase.tabs')}>
      <div className="store-section-heading">
        <div>
          <span className="app-eyebrow">{t('store.showcase.eyebrow')}</span>
          <h2>{t('store.showcase.title')}</h2>
        </div>
        <small>{t('store.showcase.caption')}</small>
      </div>

      <div className="store-product-grid store-product-grid--compact">
        {cards.map((card) => {
          const active = card.id === activeProductId;
          const access = hasAccess(card, hasPremium, hasBusiness);
          return (
            <button
              key={card.id}
              type="button"
              className={cn('store-product-tile', `store-product-tile--${card.tone}`, active && 'is-active', card.comingSoon && 'is-coming-soon')}
              onClick={() => onSelect(card)}
            >
              <span className="store-product-tile__eyebrow">{t(card.eyebrow)}</span>
              <strong>{t(card.title)}</strong>
              <small>{card.comingSoon ? t('store.status.soon') : access ? t('store.status.active') : t(card.price)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
