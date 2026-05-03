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
  return (
    <div className="px-4 pb-3">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              AI Activity
            </div>
            <div className="mt-1 text-sm text-white/85">
              {pendingCount > 0
                ? `AI ожидает ${pendingCount} ${
                    pendingCount === 1 ? 'подтверждение' : 'действия'
                  }`
                : 'AI активен и готов к действиям'}
            </div>
          </div>

          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            Active
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onOpenPending}
            className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-3 py-3 text-left"
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-amber-200/75">
              Pending
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {pendingCount}
            </div>
          </button>

          <button
            onClick={onOpenAudit}
            className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-3 py-3 text-left"
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/75">
              Audit
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {auditCount}
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              {lastAuditTimeLabel}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}