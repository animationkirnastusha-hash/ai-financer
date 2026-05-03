import type { InsightItem } from '@/features/insights/model/insight.types';
import { cn } from '@/shared/lib/cn';

type Props = {
  item: InsightItem;
  onClick?: () => void;
};

function getToneClasses(tone: InsightItem['tone']) {
  if (tone === 'positive') {
    return 'border-emerald-400/20 bg-emerald-400/10';
  }

  if (tone === 'warning') {
    return 'border-amber-400/20 bg-amber-400/10';
  }

  if (tone === 'ai') {
    return 'border-cyan-400/20 bg-cyan-400/10';
  }

  return 'border-white/10 bg-white/6';
}

function getToneLabel(tone: InsightItem['tone']) {
  if (tone === 'positive') return 'AI Result';
  if (tone === 'warning') return 'Attention';
  if (tone === 'ai') return 'AI Insight';
  return 'AI State';
}

export function InsightCard({ item, onClick }: Props) {
  const content = (
    <div
      className={cn(
        'min-w-[240px] max-w-[280px] rounded-[24px] border p-4 backdrop-blur-xl',
        getToneClasses(item.tone),
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
        {getToneLabel(item.tone)}
      </div>

      <div className="mt-2 text-sm font-semibold text-white">
        {item.title}
      </div>

      <div className="mt-2 text-sm leading-6 text-white/72">
        {item.description}
      </div>

      {item.ctaLabel ? (
        <div className="mt-3 text-xs font-medium text-white/85">
          {item.ctaLabel} →
        </div>
      ) : null}
    </div>
  );

  if (!onClick) return content;

  return (
    <button onClick={onClick} className="text-left">
      {content}
    </button>
  );
}