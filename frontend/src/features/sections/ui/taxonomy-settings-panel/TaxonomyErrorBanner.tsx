type Props = {
  error: string | null;
};

export function TaxonomyErrorBanner({ error }: Props) {
  if (!error) return null;

  return (
    <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-400/10 px-3 py-2 text-sm text-red-100/85">
      {error}
    </div>
  );
}
