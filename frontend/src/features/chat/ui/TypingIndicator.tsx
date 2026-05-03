export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-white/70">
      <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" />
    </div>
  );
}