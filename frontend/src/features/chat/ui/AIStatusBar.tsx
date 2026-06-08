import { useI18n } from '@/shared/lib/i18n';

type Props = {
  pendingCount: number;
  auditCount: number;
  lastAuditTimeLabel: string;
  onOpenPending: () => void;
  onOpenAudit: () => void;
};

export function AIStatusBar({
  pendingCount,
  auditCount,
  lastAuditTimeLabel,
  onOpenPending,
  onOpenAudit,
}: Props) {
  const { t } = useI18n();
  const hasPending = pendingCount > 0;

  return (
    <div className="px-4 pb-3">
      <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              {t('chat.status.eyebrow')}
            </div>
            <div className="mt-1 text-sm text-white/85">
              {hasPending
                ? t('chat.status.pending', { count: pendingCount })
                : t('chat.status.ready')}
            </div>
          </div>

          <div className="relative shrink-0">
            <div className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.75)]" />
            {hasPending ? (
              <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]" />
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenPending}
            className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-3 py-3 text-left transition active:scale-[0.99]"
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-amber-200/75">
              {t('chat.status.confirm')}
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {pendingCount > 0 ? t('textChat.pending.caption', { count: pendingCount }) : t('chat.status.confirm.empty')}
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              {t('chat.status.confirm.caption')}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenAudit}
            className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-3 py-3 text-left transition active:scale-[0.99]"
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/75">
              {t('chat.status.audit')}
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {t('chat.status.audit.count', { count: auditCount })}
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              {t('chat.status.audit.last', { time: lastAuditTimeLabel })}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
