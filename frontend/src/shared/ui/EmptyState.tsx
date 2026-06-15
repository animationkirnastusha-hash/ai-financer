import type { ReactNode } from 'react';

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function EmptyState({
  eyebrow = 'Фина',
  title,
  description,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-300/10 text-xl">
          {icon ?? '✦'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/65">
            {eyebrow}
          </div>

          <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
            {title}
          </h2>

          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
          ) : null}

          {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {actionLabel && onAction ? (
                <button
                  type="button"
                  onClick={onAction}
                  className="rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98]"
                >
                  {actionLabel}
                </button>
              ) : null}

              {secondaryActionLabel && onSecondaryAction ? (
                <button
                  type="button"
                  onClick={onSecondaryAction}
                  className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/80 transition active:scale-[0.98]"
                >
                  {secondaryActionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
