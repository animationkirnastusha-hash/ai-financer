import { TaxonomySettingsPanel } from '@/features/sections/ui/TaxonomySettingsPanel';
import { PageHeader } from '@/shared/ui/PageHeader';

export default function TaxonomySettingsPage() {
  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Разделы и категории" />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <TaxonomySettingsPanel />

        <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
          <div className="text-sm font-semibold text-white">Навигация</div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Свайп вправо вернёт назад в настройки. Кнопка AI Core сверху сразу выводит
            на главный экран без повторов в истории.
          </p>
        </div>
      </div>
    </div>
  );
}
