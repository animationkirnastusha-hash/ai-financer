import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  title: string;
  description?: string;
}>;

export function DashboardSection({ title, description, children }: Props) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {title}
      </div>

      {description ? (
        <div className="mt-2 text-sm leading-6 text-white/58">
          {description}
        </div>
      ) : null}

      <div className="mt-4">{children}</div>
    </section>
  );
}