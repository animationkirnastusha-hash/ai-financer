import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';

const mainLinks: Array<{ screen: AppScreen; label: string; caption: string }> = [
  { screen: 'dashboard', label: 'Главная', caption: 'Баланс, счета и картина денег' },
  { screen: 'accounts', label: 'Счета', caption: 'Карты, наличные и накопления' },
  { screen: 'goals', label: 'Цели', caption: 'Накопления и планы' },
  { screen: 'obligations', label: 'Обязательства', caption: 'Кредиты, подписки и напоминания' },
  { screen: 'sections', label: 'Категории', caption: 'Разделы расходов и доходов' },
];

const adminLinks: Array<{ screen: AppScreen; label: string; caption: string }> = [
  { screen: 'premium', label: 'Premium', caption: 'Тарифы и возможности' },
  { screen: 'business-accountant', label: 'ИИ-бухгалтер', caption: 'Для ИП, самозанятых и бизнеса' },
  { screen: 'referral', label: 'Рефералы', caption: 'Приглашения и бонусы' },
  { screen: 'admin', label: 'Админка', caption: 'Пользователи и инструменты' },
];

export function AppNavigationSheet() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const isOpen = useNavigationStore((state) => state.isNavigationMenuOpen);
  const close = useNavigationStore((state) => state.closeNavigationMenu);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));

  if (!isOpen) return null;

  const handleNavigate = (screen: AppScreen) => {
    close();
    navigateTo(screen);
  };

  const links = isAdmin ? [...mainLinks, ...adminLinks] : mainLinks;

  return (
    <div className="app-modal-backdrop app-navigation-backdrop" data-no-swipe="true" onClick={close}>
      <div className="app-modal-sheet app-navigation-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-navigation-head">
            <div>
              <div className="app-eyebrow">Меню</div>
              <h2>Куда перейти</h2>
            </div>
            <button type="button" className="app-icon-button" onClick={close} aria-label="Закрыть меню">×</button>
          </div>

          <div className="app-navigation-grid">
            {links.map((item) => (
              <button
                key={item.screen}
                type="button"
                className="app-navigation-item"
                data-active={currentScreen === item.screen}
                onClick={() => handleNavigate(item.screen)}
              >
                <span>{item.label}</span>
                <small>{item.caption}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
