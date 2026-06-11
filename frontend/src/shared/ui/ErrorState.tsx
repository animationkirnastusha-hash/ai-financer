import { useI18n } from '@/shared/lib/i18n';

type ErrorStateProps = {
  title?: string;
  message?: string | null;
  retryLabel?: string;
  onRetry?: () => void;
  onOpenAI?: () => void;
};

export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  onOpenAI,
}: ErrorStateProps) {
  const { t } = useI18n();
  const safeTitle = title?.trim() || t('errorState.title');
  const safeMessage = message?.trim() || t('errorState.message');
  const safeRetryLabel = retryLabel?.trim() || t('common.retry');

  return (
    <section className="rounded-[28px] border border-red-300/15 bg-red-400/8 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/10 text-xl">
          !
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] text-red-200/70">
            {t('errorState.eyebrow')}
          </div>

          <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
            {safeTitle}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/58">{safeMessage}</p>

          {(onRetry || onOpenAI) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98]"
                >
                  {safeRetryLabel}
                </button>
              ) : null}

              {onOpenAI ? (
                <button
                  type="button"
                  onClick={onOpenAI}
                  className="rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98]"
                >
                  {t('errorState.openAssistant')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
