type Props = {
  pendingCount: number;
  onOpenPending: () => void;
  onOpenAudit: () => void;
};

export function AICommandCenter({
  pendingCount,
  onOpenPending,
  onOpenAudit,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenAudit}
        className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-white/80"
      >
        Audit
      </button>

      <button
        onClick={onOpenPending}
        className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
      >
        Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
      </button>
    </div>
  );
}