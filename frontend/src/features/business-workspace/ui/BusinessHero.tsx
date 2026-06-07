import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useI18n } from '@/shared/lib/i18n';

export function BusinessHero() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);

  return (
    <header className="business-workspace-hero">
      <div className="business-workspace-hero__glow" aria-hidden="true" />
      <div className="business-workspace-kicker">{t('business.hero.eyebrow')}</div>
      <h1>{t('business.hero.title')}</h1>
      <p>{t('business.hero.caption')}</p>
      <div className="business-workspace-actions">
        <button type="button" className="app-primary-button" onClick={() => openModal({ type: 'report-export', mode: 'business' })}>{t('business.action.report')}</button>
        <button type="button" className="app-secondary-button" onClick={() => navigateTo('dashboard')}>{t('business.action.personal')}</button>
      </div>
    </header>
  );
}
