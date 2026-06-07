import type { StoreCard } from '@/features/store/model/storeCatalog';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  cards: StoreCard[];
  hasPremium: boolean;
  hasBusiness: boolean;
  onCardClick: (card: StoreCard) => void;
};

export function StoreCardGrid({ cards, hasPremium, hasBusiness, onCardClick }: Props) {
  const { t } = useI18n();

  return (
    <section className="store-card-grid">
      {cards.map((card) => {
        const active = card.tone === 'premium' ? hasPremium : card.tone === 'business' ? hasBusiness : false;
        return (
          <article key={card.title} className={`store-card store-card--${card.tone}`}>
            <button type="button" className="store-card__button" onClick={() => onCardClick(card)} aria-label={t(card.title)}>
              <div className="store-card__head">
                <div className="app-eyebrow">{t(card.eyebrow)}</div>
                {active ? <span>{t('store.status.active')}</span> : null}
              </div>
              <h2>{t(card.title)}</h2>
              <p>{t(card.caption)}</p>
              <ul>
                {card.items.map((item) => <li key={item}>{t(item)}</li>)}
              </ul>
              <span className="store-card__action">{t(card.action)}</span>
            </button>
          </article>
        );
      })}
    </section>
  );
}
