import type { AdminTab } from './adminPage.types';

const TABS: Array<{ id: AdminTab; title: string }> = [
  { id: 'overview', title: 'Обзор' },
  { id: 'users', title: 'Пользователи' },
  { id: 'events', title: 'События' },
  { id: 'monitoring', title: 'Состояние' },
  { id: 'training', title: 'Фина' },
  { id: 'tools', title: 'Инструменты' },
];

type Props = {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
};

export function AdminTabs({ activeTab, onChange }: Props) {
  return (
    <div className="admin-tabs" data-no-swipe="true">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          data-active={activeTab === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
