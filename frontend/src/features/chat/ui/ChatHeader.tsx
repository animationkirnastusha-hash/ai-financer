export function ChatHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
          AI-financer
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-white">AI Chat</h1>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300">
        Online
      </div>
    </div>
  );
}