import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { CreateSectionSheet } from '@/features/sections/ui/CreateSectionSheet';
import { SectionCard } from '@/features/sections/ui/SectionCard';
import { chatApi } from '@/features/chat/api/chat.api';
import { PageHeader } from '@/shared/ui/PageHeader';

type Props = {
  onBack: () => void;
};

const AI_EXAMPLES = [
  'Создай раздел Дом',
  'Запиши все расходы по продуктам в раздел Дом',
  'Запиши все расходы на водку в раздел Настроение',
  'Все траты из Steam отправляй в Игры',
];

export default function SectionsPage({ onBack }: Props) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const isLoading = useSectionsStore((state) => state.isLoading);
  const isCreating = useSectionsStore((state) => state.isCreating);
  const error = useSectionsStore((state) => state.error);
  const loadAll = useSectionsStore((state) => state.loadAll);
  const createSection = useSectionsStore((state) => state.createSection);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const ungroupedCategories = useMemo(
    () => categories.filter((category) => !category.sectionId),
    [categories],
  );

  const sendAICommand = async (command: string) => {
    setAiStatus('Отправляю команду AI...');
    try {
      await chatApi.sendMessage({ text: command });
      setAiStatus('Готово. AI обработал команду, обновляю разделы.');
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setAiStatus('AI-команда не выполнилась. Открой AI и отправь её вручную.');
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Sections" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="mx-auto max-w-[560px] space-y-4">
          <section className="rounded-[32px] border border-emerald-300/10 bg-[radial-gradient(circle_at_20%_0%,rgba(52,211,153,0.18),transparent_34%),rgba(255,255,255,0.045)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/45">
              Base function
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Разделы — твоя структура денег
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Создавай разделы вручную или через AI. Всё, что можно сделать кнопками, можно сделать командой: “перенеси продукты в Дом”.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="rounded-2xl bg-emerald-300 px-4 py-2.5 text-sm font-medium text-black"
              >
                + Раздел
              </button>
              <button
                type="button"
                onClick={() => navigateTo('ai-core')}
                className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white/75"
              >
                Открыть AI
              </button>
              <button
                type="button"
                onClick={() => void loadAll(true)}
                className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white/55"
              >
                Обновить
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  AI examples
                </div>
                <p className="mt-1 text-sm text-white/45">Быстрые команды для распределения расходов.</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-no-swipe="true">
              {AI_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void sendAICommand(example)}
                  className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65"
                >
                  {example}
                </button>
              ))}
            </div>

            {aiStatus ? <div className="mt-3 text-xs text-white/42">{aiStatus}</div> : null}
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/10 p-4 text-sm text-red-100/80">
              {error}
            </div>
          ) : null}

          <section className="space-y-3">
            {isLoading ? (
              <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-sm text-white/55">
                Загружаю разделы...
              </div>
            ) : sections.length === 0 ? (
              <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
                <div className="text-lg font-semibold text-white">Разделов пока нет</div>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Начни с “Дом”, “Развлечения” или создай свой. AI сможет сам раскладывать траты по разделам.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 rounded-2xl bg-emerald-300 px-4 py-2.5 text-sm font-medium text-black"
                >
                  Создать первый раздел
                </button>
              </div>
            ) : (
              sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  categories={categories}
                  onOpenAI={(prompt) => void sendAICommand(prompt)}
                  onSelect={() => undefined}
                />
              ))
            )}
          </section>

          {ungroupedCategories.length > 0 ? (
            <section className="rounded-[28px] border border-white/8 bg-white/[0.035] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Без раздела
              </div>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Эти категории уже есть, но пока не привязаны к разделу. Можно сказать AI: “перенеси продукты в Дом”.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ungroupedCategories.slice(0, 12).map((category) => (
                  <span key={category.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/55">
                    {category.icon ? `${category.icon} ` : ''}{category.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <CreateSectionSheet
        open={isCreateOpen}
        isCreating={isCreating}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (payload) => {
          await createSection(payload);
        }}
      />
    </div>
  );
}
