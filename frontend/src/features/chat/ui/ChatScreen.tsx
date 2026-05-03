import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { AIStatusBar } from '@/features/chat/ui/AIStatusBar';
import { ChatHeader } from '@/features/chat/ui/ChatHeader';
import { Composer } from '@/features/chat/ui/Composer';
import { MessageList } from '@/features/chat/ui/MessageList';
import { useChatController } from '@/features/chat/model/useChatController';
import { InsightsStrip } from '@/features/insights/ui/InsightsStrip';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { formatTime } from '@/shared/lib/format';

export function ChatScreen() {
  const {
    messages,
    isSending,
    sendMessage,
    confirmAction,
    cancelAction,
    pendingActions,
    auditLogs,
    isPendingOpen,
    isAuditOpen,
    openPending,
    closePending,
    openAudit,
    closeAudit,
  } = useChatController();

  const lastAuditTime =
    auditLogs.length > 0
      ? formatTime(auditLogs[0].createdAt || auditLogs[0].created_at)
      : 'нет событий';

  return (
    <div className="flex h-dvh flex-col bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <div className="mx-auto flex h-full w-full max-w-[520px] flex-col">
        <ChatHeader />

        <AIStatusBar
          pendingCount={pendingActions.length}
          auditCount={auditLogs.length}
          lastAuditTimeLabel={lastAuditTime}
          onOpenPending={openPending}
          onOpenAudit={openAudit}
        />

        <InsightsStrip
          pendingActions={pendingActions}
          auditLogs={auditLogs}
          onOpenPending={openPending}
          onOpenAudit={openAudit}
        />

        <MessageList
          messages={messages}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />

        <Composer onSend={sendMessage} disabled={isSending} />
      </div>

      <PendingActionsDrawer
        open={isPendingOpen}
        items={pendingActions}
        onClose={closePending}
        onConfirm={confirmAction}
        onCancel={cancelAction}
      />

      <AuditLogDrawer
        open={isAuditOpen}
        items={auditLogs}
        onClose={closeAudit}
      />
    </div>
  );
}