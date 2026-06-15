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
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" data-no-swipe="true">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
            activeTab === item.id ? 'border-emerald-300/40 bg-emerald-300/12 text-emerald-100' : 'border-white/10 bg-white/[0.035] text-white/55'
          }`}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
