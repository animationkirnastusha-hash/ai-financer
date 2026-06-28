import { useI18n } from '@/shared/lib/i18n';

type Props = {
  onCreate: () => void;
};

export function EmptyAccountsState({ onCreate }: Props) {
  const { t } = useI18n();

  return (
    <section className="app-card app-accounts-empty">
      <div className="app-eyebrow">{t('accounts.empty.eyebrow')}</div>
      <h2>{t('accounts.empty.title')}</h2>
      <p>{t('accounts.empty.caption')}</p>
      <button type="button" onClick={onCreate} className="app-primary-button">
        {t('accounts.empty.action')}
      </button>
    </section>
  );
}
