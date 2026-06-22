import { useEffect, useMemo, useState } from 'react';
import type { StoreCard } from '@/features/store/model/storeCatalog';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  cards: StoreCard[];
  activeTone: StoreCard['tone'];
  hasPremium: boolean;
  hasBusiness: boolean;
  onSelect: (card: StoreCard) => void;
  onBuy: (card: StoreCard) => void;
};

const AUTO_SLIDE_MS = 6200;

function getPriceKey(tone: StoreCard['tone']) {
  if (tone === 'business') return 'store.showcase.businessSoonPrice';
  if (tone === 'premium') return 'store.showcase.premiumPrice';
  return 'store.showcase.referralPrice';
}

export function StoreProductCarousel({ cards, activeTone, hasPremium, hasBusiness, onSelect, onBuy }: Props) {
  const { t } = useI18n();
  const [isAutoPaused, setIsAutoPaused] = useState(false);

  const activeIndex = useMemo(() => {
    const index = cards.findIndex((card) => card.tone === activeTone);
    return index >= 0 ? index : 0;
  }, [activeTone, cards]);

  const activeCard = cards[activeIndex] ?? cards[0];

  useEffect(() => {
    if (isAutoPaused || cards.length < 2) return;

    const timer = window.setInterval(() => {
      const next = cards[(activeIndex + 1) % cards.length];
      if (next) onSelect(next);
    }, AUTO_SLIDE_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, cards, isAutoPaused, onSelect]);

  if (!activeCard) return null;

  const isActiveAccess = activeCard.comingSoon ? false : activeCard.tone === 'premium' ? hasPremium : activeCard.tone === 'business' ? hasBusiness : false;
  const isActiveBlocked = Boolean(activeCard.comingSoon);
  const compactItems = activeCard.items.slice(0, 3);

  const handlePointerDown = () => setIsAutoPaused(true);
  const handlePointerUp = () => setIsAutoPaused(false);

  return (
    <section className="store-carousel" aria-label={t('store.carousel.aria')}>
      <div className="store-carousel__viewport" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div className="store-carousel__track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {cards.map((card) => {
            const hasAccess = card.comingSoon ? false : card.tone === 'premium' ? hasPremium : card.tone === 'business' ? hasBusiness : false;

            return (
              <article key={card.tone} className={cn('store-carousel-card', `store-carousel-card--${card.tone}`)}>
                <div className="store-carousel-card__glow" aria-hidden="true" />
                <div className="store-carousel-card__top">
                  <span>{t(card.eyebrow)}</span>
                  {card.comingSoon ? <strong>{t('store.status.soon')}</strong> : hasAccess ? <strong>{t('store.status.active')}</strong> : null}
                </div>
                <div className="store-carousel-card__copy">
                  <h2>{t(card.title)}</h2>
                  <p>{t(card.caption)}</p>
                </div>
                <ul className="store-carousel-card__list">
                  {card.items.slice(0, 3).map((item) => (
                    <li key={item}>{t(item)}</li>
                  ))}
                </ul>
                <div className="store-carousel-card__price">
                  <span>{t('store.showcase.price')}</span>
                  <strong>{t(getPriceKey(card.tone))}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="store-carousel__controls">
        <div className="store-carousel__dots" role="tablist" aria-label={t('store.showcase.tabs')}>
          {cards.map((card, index) => (
            <button
              key={card.tone}
              type="button"
              className={cn(index === activeIndex && 'is-active')}
              aria-label={t(card.title)}
              aria-selected={index === activeIndex}
              onClick={() => onSelect(card)}
            />
          ))}
        </div>
        <div className="store-carousel__mini-list" aria-hidden="true">
          {compactItems.map((item) => <span key={item}>{t(item)}</span>)}
        </div>
      </div>

      <button type="button" className="store-carousel__buy app-primary-button app-animate-pop" onClick={() => onBuy(activeCard)} disabled={isActiveAccess || isActiveBlocked}>
        {isActiveBlocked ? t('store.action.businessSoon') : isActiveAccess ? t('store.status.active') : t('store.carousel.buy')}
      </button>
    </section>
  );
}
