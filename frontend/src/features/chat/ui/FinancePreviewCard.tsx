import { useState } from "react";

import { getPreviewFromMessageData } from "@/features/pending-actions/lib/pendingActionView";
import { cn } from "@/shared/lib/cn";
import { useI18n } from "@/shared/lib/i18n";
import { Button, Surface } from "@/shared/ui";

type FinancePreviewCardProps = {
  title: string;
  intent?: string;
  actionId?: string;
  data?: Record<string, unknown>;
  onConfirm?: (id: string) => void | Promise<void>;
  onCancel?: (id: string) => void | Promise<void>;
};

export function FinancePreviewCard({
  title,
  intent,
  actionId,
  data,
  onConfirm,
  onCancel,
}: FinancePreviewCardProps) {
  const { language, t } = useI18n();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<
    "confirm" | "cancel" | null
  >(null);
  const view = getPreviewFromMessageData({ title, intent, data, language });
  const requiresConfirmation = Boolean(actionId);
  const isProcessing = Boolean(submittedAction) || isConfirming || isCancelling;

  const handleConfirm = async () => {
    if (!actionId || isProcessing) return;

    setSubmittedAction("confirm");
    setIsConfirming(true);
    try {
      await onConfirm?.(actionId);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!actionId || isProcessing) return;

    setSubmittedAction("cancel");
    setIsCancelling(true);
    try {
      await onCancel?.(actionId);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Surface className="text-chat-preview-card mx-auto w-full max-w-[360px] overflow-hidden border-emerald-300/16 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_35%),rgba(255,255,255,0.045)]">
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/85">
            {t("chat.preview.check")}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
              view.riskTone === "safe" &&
                "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/80",
              view.riskTone === "medium" &&
                "border-amber-300/20 bg-amber-300/10 text-amber-100/80",
              view.riskTone === "high" &&
                "border-rose-300/20 bg-rose-300/10 text-rose-100/80",
            )}
          >
            {view.riskLabel}
          </span>
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/35">
          {view.intentLabel}
        </div>

        <div className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">
          {view.amountLabel || view.title}
        </div>

        {view.amountLabel ? (
          <div className="mt-1 text-[13px] leading-5 text-white/65">
            {view.title}
          </div>
        ) : null}

        <div className="mt-2 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-white/72">
          {view.explanation}
        </div>

        {view.rows.length > 0 ? (
          <div className="mt-2 grid gap-1">
            {view.rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-1.5 text-[12px]"
              >
                <span className="text-white/45">{row.label}</span>
                <span className="max-w-[62%] truncate text-right font-medium text-white/88">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {requiresConfirmation ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button fullWidth disabled={isProcessing} onClick={handleConfirm}>
              {submittedAction === "confirm" && !isConfirming
                ? t("chat.preview.confirmed")
                : isConfirming
                  ? t("chat.preview.confirming")
                  : t("chat.preview.confirm")}
            </Button>

            <Button
              fullWidth
              variant="secondary"
              disabled={isProcessing}
              onClick={handleCancel}
            >
              {submittedAction === "cancel" && !isCancelling
                ? t("chat.preview.cancelled")
                : isCancelling
                  ? t("chat.preview.cancelling")
                  : t("chat.preview.cancel")}
            </Button>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-[13px] text-emerald-200">
            {t("chat.preview.done")}
          </div>
        )}
      </div>
    </Surface>
  );
}
