type Props = {
  text: string;
};

export function InsightPill({ text }: Props) {
  return (
    <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-white/75">
      {text}
    </div>
  );
}