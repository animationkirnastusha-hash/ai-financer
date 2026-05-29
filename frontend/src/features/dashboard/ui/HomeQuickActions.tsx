import type { AppScreen } from '@/features/navigation/model/navigation.store';

type Props = {
  onNavigate: (screen: AppScreen) => void;
  onTextInput: (command?: string) => void;
};

const actions = [
  { label: 'Расход', caption: 'Записать покупку', command: 'расход ' },
  { label: 'Доход', caption: 'Добавить поступление', command: 'доход ' },
  { label: 'Счета', caption: 'Карты и наличные', screen: 'accounts' as const },
  { label: 'Цели', caption: 'Накопления', screen: 'goals' as const },
];

export function HomeQuickActions({ onNavigate, onTextInput }: Props) {
  return (
    <section className="app-home-section app-home-quick-actions" aria-label="Быстрые действия">
      {actions.map((item) => (
        <button
          key={item.label}
          type="button"
          className="app-home-quick-action"
          onClick={() => {
            if ('screen' in item && item.screen) onNavigate(item.screen);
            else onTextInput('command' in item ? item.command : undefined);
          }}
        >
          <span>{item.label}</span>
          <small>{item.caption}</small>
        </button>
      ))}
    </section>
  );
}
