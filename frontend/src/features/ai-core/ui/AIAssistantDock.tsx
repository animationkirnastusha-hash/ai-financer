type Props = {
  onOpen: () => void;
};

export function AIAssistantDock({ onOpen }: Props) {
  return (
    <button 
      type="button"
      onClick={onOpen}
      className="ai-assistant-dock fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/20 bg-[#0d1713]/80 text-white shadow-[0_0_44px_rgba(52,211,153,0.22)] backdrop-blur-xl transition active:scale-95"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 82px)' }}
      aria-label="Open AI assistant"
      data-no-swipe="true"
    >
      <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl" />

      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
          AI
        </div>
      </div>
    </button>
  );
}