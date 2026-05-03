type Props = {
  title: string;
  description: string;
  onClick?: () => void;
};

export function QuickActionCard({ title, description, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[24px] border border-white/8 bg-black/20 p-4 text-left transition hover:bg-white/[0.05]"
    >
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/55">{description}</div>
    </button>
  );
}