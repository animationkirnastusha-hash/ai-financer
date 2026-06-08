import { useI18n } from '@/shared/lib/i18n';
type Props = {
  open: boolean;
  onClose: () => void;
  onOpenAI: () => void;
  onOpenCommands: () => void;
  onOpenVoice: () => void;
};

export function AIMenuSheet({
  open,
  onClose,
  onOpenAI,
  onOpenCommands,
  onOpenVoice,
}: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full rounded-t-[28px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t('ai.menu.eyebrow')}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {t('ai.menu.title')}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onOpenAI}
            className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
          >
            <div className="text-sm font-medium text-white">{t('ai.menu.text.title')}</div>
            <div className="mt-1 text-xs text-white/45">
              {t('ai.menu.text.caption')}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenCommands}
            className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
          >
            <div className="text-sm font-medium text-white">{t('ai.menu.commands.title')}</div>
            <div className="mt-1 text-xs text-white/45">
              {t('ai.menu.commands.caption')}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenVoice}
            className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
          >
            <div className="text-sm font-medium text-white">{t('ai.menu.voice.title')}</div>
            <div className="mt-1 text-xs text-white/45">
              {t('ai.menu.voice.caption')}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}