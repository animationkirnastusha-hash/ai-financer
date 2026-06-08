import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type ModuleState = 'ready' | 'soon';

type BusinessModule = {
  title: I18nKey;
  caption: I18nKey;
  state: ModuleState;
};

const modules: BusinessModule[] = [
  { title: 'business.module.workspace.title', caption: 'business.module.workspace.caption', state: 'ready' },
  { title: 'business.module.reports.title', caption: 'business.module.reports.caption', state: 'ready' },
  { title: 'business.module.taxes.title', caption: 'business.module.taxes.caption', state: 'soon' },
  { title: 'business.module.docs.title', caption: 'business.module.docs.caption', state: 'soon' },
];

function stateLabel(state: ModuleState, t: (key: string) => string) {
  if (state === 'ready') return t('business.badge.available');
  return t('business.badge.soon');
}

export function BusinessModuleList() {
  const { t } = useI18n();

  return (
    <section className="app-card business-module-section">
      <div className="business-section-head">
        <div>
          <div className="app-eyebrow">{t('business.modules.eyebrow')}</div>
          <h2>{t('business.modules.title')}</h2>
        </div>
      </div>
      <div className="business-module-list">
        {modules.map((item) => (
          <article key={item.title} className="business-module-card">
            <div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.caption)}</p>
            </div>
            <span className={`business-workspace-badge business-workspace-badge--${item.state}`}>{stateLabel(item.state, t)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
