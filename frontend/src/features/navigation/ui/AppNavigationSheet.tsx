import type { AppScreen } from '@/features/navigation/model/navigation.store';

type NavigationItem = {
  screen: AppScreen;
  title: string;
  description: string;
  icon: string;
  adminOnly?: boolean;
};

type Props = {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onNavigate: (screen: AppScreen) => void;
};

const mainItems: NavigationItem[] = [
  { screen: 'dashboard', title: 'Главная', description: 'Баланс, быстрые действия и Фина', icon: '⌂' },
  { screen: 'transactions', title: 'Операции', description: 'Расходы, доходы и переводы', icon: '◷' },
  { screen: 'accounts', title: 'Счета', description: 'Карта, наличка и другие кошельки', icon: '◉' },
  { screen: 'analytics', title: 'Аналитика', description: 'Куда уходят деньги и что меняется', icon: '◇' },
  { screen: 'goals', title: 'Цели', description: 'Накопления, планы и прогресс', icon: '◎' },
  { screen: 'sections', title: 'Категории', description: 'Разделы расходов и доходов', icon: '▦' },
  { screen: 'companion', title: 'Компаньон', description: 'XP, уровень и развитие Фины', icon: '✦' },
  { screen: 'settings', title: 'Настройки', description: 'Валюта, голос, интерфейс и данные', icon: '⚙' },
];

const adminItems: NavigationItem[] = [
  { screen: 'premium', title: 'Premium', description: 'Тарифы, trial и будущие возможности', icon: '★', adminOnly: true },
  { screen: 'referral', title: 'Рефералы', description: 'Приглашения и будущие бонусы', icon: '↗', adminOnly: true },
  { screen: 'business-accountant', title: 'ИИ-бухгалтер', description: 'ИП, самозанятые и малый бизнес', icon: '▣', adminOnly: true },
  { screen: 'admin', title: 'Админка', description: 'Пользователи, тесты и служебные действия', icon: '⌘', adminOnly: true },
];

export function AppNavigationSheet({ open, isAdmin, onClose, onNavigate }: Props) {
  if (!open) return null;

  const items = isAdmin ? [...mainItems, ...adminItems] : mainItems;

  const handleNavigate = (screen: AppScreen) => {
    onNavigate(screen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm" data-no-swipe="true">
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Меню</div>
              <div className="mt-1 text-lg font-semibold text-white">Куда перейти?</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
            >
              Закрыть
            </button>
          </div>

          <div className="mt-5 grid gap-2">
            {items.map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => handleNavigate(item.screen)}
                className="w-full rounded-[22px] border border-white/8 bg-white/[0.045] p-4 text-left transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-lg text-emerald-100/80">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">{item.description}</span>
                  </span>
                  <span className="ml-auto text-white/25">›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
