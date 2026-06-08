import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import type { StoreCard } from '@/features/store/model/storeCatalog';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  premiumCard: StoreCard;
  onPremiumOpen: (card: StoreCard) => void;
};

export function StoreHero({ premiumCard, onPremiumOpen }: Props) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(user?.isAdmin);
  const name = user?.firstName || user?.username || t('store.userFallback');

  return (
    <header className="monetization-hero store-hero">
      <div className="monetization-hero__glow" aria-hidden="true" />
      <div className="monetization-kicker">{t('store.hero.eyebrow')}</div>
      <h1>{t('store.hero.title', { name })}</h1>
      <p>{t('store.hero.caption')}</p>
      <div className="monetization-hero__actions">
        <button type="button" className="app-primary-button" onClick={() => onPremiumOpen(premiumCard)}>{t('store.action.premium')}</button>
        <button type="button" className="app-secondary-button" onClick={() => navigateTo('referral')}>{t('store.action.referral')}</button>
        {isAdmin ? <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>{t('store.action.admin')}</button> : null}
      </div>
    </header>
  );
}
