import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { useI18n } from '@/shared/lib/i18n';

type UtilityModal = Extract<AppModalDescriptor, { type: 'accounts-tools' | 'taxonomy-tools' | 'taxonomy-section' }>;

type Props = {
  modal: UtilityModal;
  layer: number;
  accounts: AccountDto[];
  categories: CategoryDto[];
  primaryAccountId: string | null;
  incomeAccountId: string | null;
  mainCurrency: string;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  openModal: (modal: AppModalDescriptor) => void;
  setMainCurrency: (currency: 'RUB' | 'USD' | 'EUR') => void;
};

export function UtilityModals({
  modal,
  layer,
  accounts,
  categories,
  primaryAccountId,
  incomeAccountId,
  mainCurrency,
  closeModal,
  openModal,
  setMainCurrency,
}: Props) {
  const { t } = useI18n();

  switch (modal.type) {
    case 'accounts-tools':
      return (
        <div className="app-modal-backdrop" style={{ zIndex: layer }} data-no-swipe="true" onClick={() => closeModal('accounts-tools')}>
          <div className="app-modal-sheet app-accounts-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">{t('utility.accounts.eyebrow')}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{t('utility.accounts.title')}</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">{t('utility.accounts.caption')}</p>
              </div>
              <section className="app-settings-grid">
                <div className="app-settings-tile">
                  <div className="text-xs text-white/42">{t('utility.accounts.mainCurrency')}</div>
                  <div className="mt-3 flex gap-2">
                    {(['RUB', 'USD', 'EUR'] as const).map((currency) => (
                      <button key={currency} type="button" onClick={() => setMainCurrency(currency)} className={mainCurrency === currency ? 'app-choice app-choice--active' : 'app-choice'}>
                        {currency}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="app-settings-tile"><small>{t('utility.accounts.primary')}</small><b>{accounts.find((item) => item.id === primaryAccountId)?.name || t('utility.accounts.notSelected')}</b></div>
                <div className="app-settings-tile"><small>{t('utility.accounts.income')}</small><b>{accounts.find((item) => item.id === incomeAccountId)?.name || t('utility.accounts.notSelected')}</b></div>
              </section>
            </div>
            <footer className="app-modal-footer">
              <button type="button" onClick={() => closeModal('accounts-tools')} className="app-secondary-button w-full">{t('utility.common.done')}</button>
            </footer>
          </div>
        </div>
      );
    case 'taxonomy-tools':
      return (
        <div className="app-modal-backdrop" style={{ zIndex: layer }} data-no-swipe="true" onClick={() => closeModal('taxonomy-tools')}>
          <div className="app-modal-sheet app-taxonomy-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">{t('utility.taxonomy.eyebrow')}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{t('utility.taxonomy.title')}</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">{t('utility.taxonomy.caption')}</p>
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-tools')} className="app-secondary-button">{t('utility.common.close')}</button>
                <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-primary-button">{t('utility.taxonomy.newSection')}</button>
              </div>
            </footer>
          </div>
        </div>
      );
    case 'taxonomy-section': {
      const section = modal.section;
      const modalCategories = section === 'ungrouped'
        ? categories.filter((category) => !category.sectionId)
        : categories.filter((category) => category.sectionId === section.id);
      return (
        <div className="app-modal-backdrop" style={{ zIndex: layer }} data-no-swipe="true" onClick={() => closeModal('taxonomy-section')}>
          <div className="app-modal-sheet app-taxonomy-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div className="app-taxonomy-modal__head">
                <div>
                  <div className="app-eyebrow">{t('utility.taxonomy.eyebrow')}</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{section === 'ungrouped' ? t('utility.taxonomy.ungrouped') : section.name}</h2>
                </div>
                {section === 'ungrouped' ? null : <button type="button" onClick={() => openModal({ type: 'section-edit', section })} className="app-secondary-button">{t('utility.taxonomy.edit')}</button>}
              </div>
              <div className="grid gap-2">
                {modalCategories.length === 0 ? <div className="app-empty-inline">{t('utility.taxonomy.empty')}</div> : null}
                {modalCategories.map((category) => (
                  <button key={category.id} type="button" onClick={() => openModal({ type: 'category-edit', category })} className="app-list-button">
                    <span>{category.icon ? `${category.icon} ` : ''}{category.name}</span>
                    <small>{category.type === 'income' ? t('utility.taxonomy.type.income') : category.type === 'both' ? t('utility.taxonomy.type.both') : t('utility.taxonomy.type.expense')}</small>
                  </button>
                ))}
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-section')} className="app-secondary-button">{t('utility.common.close')}</button>
                <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: section === 'ungrouped' ? null : section.id })} className="app-primary-button">{t('utility.taxonomy.category')}</button>
              </div>
            </footer>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
