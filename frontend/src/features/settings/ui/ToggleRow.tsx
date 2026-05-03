type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description ? (
          <div className="mt-1 text-xs leading-5 text-white/48">
            {description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? 'bg-emerald-400/90' : 'bg-white/12'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}