import type { SectionDto, CategoryDto } from '@/features/sections/api/sections.api';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  section: SectionDto;
  categories: CategoryDto[];
  onOpenAI: (prompt: string) => void;
  onSelect?: () => void;
};

export function SectionCard({ section, categories, onOpenAI, onSelect }: Props) {
  const sectionCategories = categories.filter((category) => category.sectionId === section.id);
  const expenses = Number(section.totals?.expenses ?? 0);
  const transactionCount = Number(section.totals?.transactionCount ?? 0);

  return (
    <article className="rounded-[30px] border border-white/8 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl border border-white/10 bg-white/8 text-2xl">
              {section.icon || '◌'}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{section.name}</h3>
              <p className="mt-1 text-xs leading-5 text-white/42">
                {section.description || 'Раздел для расходов, категорий и AI-правил'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/12 bg-emerald-300/8 px-3 py-2 text-right">
            <div className="text-xs text-emerald-100/55">Расходы</div>
            <div className="mt-1 text-sm font-semibold text-emerald-100">
              {expenses > 0 ? formatMoney(expenses, 'RUB', { sign: 'minus' }) : '—'}
            </div>
          </div>
        </div>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        {sectionCategories.slice(0, 5).map((category) => (
          <span
            key={category.id}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/60"
          >
            {category.icon ? `${category.icon} ` : ''}{category.name}
          </span>
        ))}
        {sectionCategories.length === 0 ? (
          <span className="rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-white/38">
            Категории можно добавить вручную или через AI
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/45">
        <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
          <div className="text-white/32">Категорий</div>
          <div className="mt-1 text-base font-semibold text-white/80">{sectionCategories.length}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
          <div className="text-white/32">Операций</div>
          <div className="mt-1 text-base font-semibold text-white/80">{transactionCount || '—'}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-no-swipe="true">
        <button
          type="button"
          onClick={() => onOpenAI(`Запиши все расходы по продуктам в раздел ${section.name}`)}
          className="shrink-0 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/70"
        >
          Продукты → {section.name}
        </button>
        <button
          type="button"
          onClick={() => onOpenAI(`Создай категорию для раздела ${section.name}`)}
          className="shrink-0 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/70"
        >
          + Категория
        </button>
      </div>
    </article>
  );
}
