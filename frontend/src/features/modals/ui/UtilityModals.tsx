import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

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
  switch (modal.type) {
    case 'accounts-tools':
      return (
        <div className="app-modal-backdrop" style={{ zIndex: layer }} data-no-swipe="true" onClick={() => closeModal('accounts-tools')}>
          <div className="app-modal-sheet app-accounts-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">Счета</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Правила кошелька</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">Выбери основную валюту и быстро проверь важные счета.</p>
              </div>
              <section className="app-settings-grid">
                <div className="app-settings-tile">
                  <div className="text-xs text-white/42">Основная валюта</div>
                  <div className="mt-3 flex gap-2">
                    {(['RUB', 'USD', 'EUR'] as const).map((currency) => (
                      <button key={currency} type="button" onClick={() => setMainCurrency(currency)} className={mainCurrency === currency ? 'app-choice app-choice--active' : 'app-choice'}>
                        {currency}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="app-settings-tile"><small>Главный счёт</small><b>{accounts.find((item) => item.id === primaryAccountId)?.name || 'Не выбран'}</b></div>
                <div className="app-settings-tile"><small>Доходы</small><b>{accounts.find((item) => item.id === incomeAccountId)?.name || 'Не выбран'}</b></div>
              </section>
            </div>
            <footer className="app-modal-footer">
              <button type="button" onClick={() => closeModal('accounts-tools')} className="app-secondary-button w-full">Готово</button>
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
                <div className="app-eyebrow">Категории</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Порядок для расходов и доходов</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">Разделы объединяют категории и помогают видеть, куда уходят деньги.</p>
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-tools')} className="app-secondary-button">Закрыть</button>
                <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-primary-button">Новый раздел</button>
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
                  <div className="app-eyebrow">Категории</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{section === 'ungrouped' ? 'Без раздела' : section.name}</h2>
                </div>
                {section === 'ungrouped' ? null : <button type="button" onClick={() => openModal({ type: 'section-edit', section })} className="app-secondary-button">Править</button>}
              </div>
              <div className="grid gap-2">
                {modalCategories.length === 0 ? <div className="app-empty-inline">Категорий пока нет.</div> : null}
                {modalCategories.map((category) => (
                  <button key={category.id} type="button" onClick={() => openModal({ type: 'category-edit', category })} className="app-list-button">
                    <span>{category.icon ? `${category.icon} ` : ''}{category.name}</span>
                    <small>{category.type === 'income' ? 'Доходы' : category.type === 'both' ? 'Расходы и доходы' : 'Расходы'}</small>
                  </button>
                ))}
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-section')} className="app-secondary-button">Закрыть</button>
                <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: section === 'ungrouped' ? null : section.id })} className="app-primary-button">Категория</button>
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
