import type { ChatMessage } from "@/features/chat/model/chat.types";
import { appendLocalMessages } from "@/features/chat/model/chatController.utils";
import { parseNavigationIntent } from "@/features/navigation/lib/parseNavigationIntent";
import type { AppScreen } from "@/features/navigation/model/navigation.store";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
type SetMessagesFn = (value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void;

function getScreenLabel(screen: AppScreen, t: TranslateFn) {
  const keys: Partial<Record<AppScreen, string>> = {
    dashboard: "screen.dashboard",
    accounts: "screen.accounts",
    analytics: "screen.analytics",
    goals: "screen.goals",
    obligations: "screen.obligations",
    "spending-limits": "screen.limits",
    companion: "screen.companion",
    settings: "screen.settings",
    store: "screen.store",
    premium: "screen.premium",
    "business-accountant": "screen.business",
    "receipt-scans": "screen.receipts",
    sections: "screen.sections",
    admin: "screen.admin",
    referral: "screen.referral",
  };

  return t(keys[screen] ?? "common.section");
}

function appendAssistantNavigationMessage(
  setMessages: SetMessagesFn,
  message: Omit<ChatMessage, "id" | "role" | "createdAt">,
) {
  setMessages((prev) =>
    appendLocalMessages(prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      createdAt: new Date().toISOString(),
      ...message,
    }),
  );
}

export function handleChatNavigationIntent({
  text,
  t,
  setMessages,
  navigateTo,
  goBack,
}: {
  text: string;
  t: TranslateFn;
  setMessages: SetMessagesFn;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
}) {
  const navigationIntent = parseNavigationIntent(text);

  if (navigationIntent.type === "open_screen") {
    navigateTo(navigationIntent.screen);
    const message = t("textChat.nav.openScreen", {
      screen: getScreenLabel(navigationIntent.screen, t),
    });
    appendAssistantNavigationMessage(setMessages, {
      text: message,
      content: message,
      kind: "success",
      actionType: "navigation",
    });
    return true;
  }

  if (navigationIntent.type === "go_back") {
    goBack();
    const message = t("textChat.nav.back");
    appendAssistantNavigationMessage(setMessages, {
      text: message,
      content: message,
      kind: "success",
      actionType: "navigation",
    });
    return true;
  }

  if (navigationIntent.type === "open_text_chat") {
    const message = t("textChat.nav.chatOpen");
    appendAssistantNavigationMessage(setMessages, {
      text: message,
      content: message,
      kind: "text",
      actionType: "navigation",
    });
    return true;
  }

  return false;
}
