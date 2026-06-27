import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useI18n } from '@/shared/lib/i18n';

export default function StorePage() {
  const { t } = useI18n();
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  return (
    <div className="app-page app-store-page text-white">
      <div className="app-page__inner app-store-shell">
        <ScreenTopBar title={t('screen.store')} left="back" right={['notifications', 'home']} />
        <header className="app-card app-store-hero">
          <div className="app-eyebrow">{t('store.hero.eyebrow')}</div>
          <h1 className="app-hero-title">{t('store.hero.title')}</h1>
          <p className="app-hero-caption">{t('store.hero.caption')}</p>
        </header>
        <section className="app-store-products">
          <article className="app-card app-store-product">
            <span>{t('store.product.premium.eyebrow')}</span>
            <h2>{t('store.product.premium.title')}</h2>
            <p>{t('store.product.premium.caption')}</p>
            <button type="button" className="app-primary-button" onClick={() => openAIWithCommand('Расскажи про Premium и как его подключить')}>{t('store.action.details')}</button>
          </article>
          <article className="app-card app-store-product">
            <span>{t('store.product.business.eyebrow')}</span>
            <h2>{t('store.product.business.title')}</h2>
            <p>{t('store.product.business.caption')}</p>
            <button type="button" className="app-secondary-button" onClick={() => openAIWithCommand('Расскажи про бизнес аккаунт')}>{t('store.action.details')}</button>
          </article>
        </section>
      </div>
    </div>
  );
}
