import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreOrb } from '@/features/ai-core/ui/AICoreOrb';
import { AICoreInput } from '@/features/ai-core/ui/AICoreInput';
import { AICoreBalanceHero } from '@/features/ai-core/ui/AICoreBalanceHero';
import { AICoreQuickPrompts } from '@/features/ai-core/ui/AICoreQuickPrompts';
import { AICoreRecentActivity } from '@/features/ai-core/ui/AICoreRecentActivity';
import { useAICoreController } from '@/features/ai-core/model/useAICoreController';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export function AICoreScreen() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const {
    coreState,
    inputValue,
    setInputValue,
    submit,
    closeCommandPanel,
    handleOrbTap,
    handleOrbHoldStart,
    handleOrbHoldEnd,

    latestAssistantMessage,

    pendingActions,
    confirmAction,
    cancelAction,

    isPendingOpen,
    openPending,
    closePending,

    isSending,

    voiceTranscript,
    voiceState,
    voiceError,
    isVoiceSupported,

    isCommandPanelOpen,
    isCommandListOpen,
    openCommandList,
    closeCommandList,
    runQuickCommand,
  } = useAICoreController();

  const pendingCount = pendingActions.length;

  const liveText =
    voiceState === 'recording'
      ? voiceTranscript || 'Слушаю...'
      : voiceState === 'uploading'
        ? 'Обрабатываю голос...'
        : voiceState === 'speaking'
          ? 'AI отвечает...'
          : isSending
            ? 'AI думает...'
            : 'AI активен';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#040811_0%,#07111b_100%)] text-white">
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden">

        {/* HEADER */}
        <header className="shrink-0 px-4 pt-5 pb-2">
          <div className="flex items-center justify-between">

            <button
              type="button"
              onClick={openCommandList}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
            >
              <span className="text-emerald-200 text-xl">⌘</span>
            </button>

            <div className="text-center">
              <div className="text-[32px] font-semibold tracking-tight leading-none">
                ai finance
              </div>

              <div className="mt-1 text-xs text-white/38">
                ваш финансовый ai
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
            >
              <span className="text-emerald-200 text-lg">•••</span>
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 pb-44 no-scrollbar">

          <div className="space-y-4">

            <AICoreBalanceHero />

            {/* LIVE STATUS */}
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-white/72">{liveText}</span>
              </div>

              {pendingCount > 0 ? (
                <button
                  onClick={openPending}
                  className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                >
                  Ждёт: {pendingCount}
                </button>
              ) : (
                <span className="text-xs text-emerald-200/80">Active</span>
              )}
            </div>

            {/* CORE */}
            <section className="relative flex flex-col items-center justify-center py-3">

              <AICoreOrb
                state={coreState}
                onTap={handleOrbTap}
                onHoldStart={handleOrbHoldStart}
                onHoldEnd={handleOrbHoldEnd}
              />

              <div className="mt-5 text-center">
                <div className="text-lg font-medium text-white">
                  Нажми и скажи
                </div>

                <div className="mt-1 text-sm text-white/38">
                  или напиши команду ниже
                </div>
              </div>
            </section>

            {/* INPUT */}
            {isCommandPanelOpen ? (
               <AICoreInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={submit}
                  onClose={closeCommandPanel}
                  disabled={isSending}
              />
            ) : null}

            {/* QUICK COMMANDS */}
            <AICoreQuickPrompts onRunCommand={runQuickCommand} />

            {/* PREVIEW */}
            {latestAssistantMessage?.kind === 'preview' ? (
              <FinancePreviewCard
                title={latestAssistantMessage.text}
                intent={latestAssistantMessage.actionType}
                actionId={latestAssistantMessage.actionId}
                data={latestAssistantMessage.data}
                onConfirm={confirmAction}
                onCancel={cancelAction}
              />
            ) : null}

            {/* RESPONSE */}
            {latestAssistantMessage &&
            latestAssistantMessage.kind !== 'preview' ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  AI Response
                </div>

                <div className="mt-2 text-sm leading-6 text-white">
                  {latestAssistantMessage.text}
                </div>
              </section>
            ) : null}

            {/* ERRORS */}
            {voiceError ? (
              <section className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Голос временно недоступен. Используй текстовый ввод.
              </section>
            ) : null}

            {!isVoiceSupported ? (
              <section className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/55">
                Голос не поддерживается устройством.
              </section>
            ) : null}

            {/* HISTORY */}
            <AICoreRecentActivity />

          </div>
        </div>
      </div>

      {/* DRAWERS */}
      <PendingActionsDrawer
        open={isPendingOpen}
        items={pendingActions}
        onClose={closePending}
        onConfirm={confirmAction}
        onCancel={cancelAction}
      />

      <CommandListSheet
        open={isCommandListOpen}
        onClose={closeCommandList}
        onRunCommand={runQuickCommand}
      />
    </div>
  );
}