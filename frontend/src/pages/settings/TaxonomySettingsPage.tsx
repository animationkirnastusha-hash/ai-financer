import { TaxonomySettingsPanel } from '@/features/sections/ui/TaxonomySettingsPanel';
import { PageHeader } from '@/shared/ui/PageHeader';

export default function TaxonomySettingsPage() {
  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Разделы" subtitle="Категории и структура" />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <TaxonomySettingsPanel />
      </div>
    </div>
  );
}
