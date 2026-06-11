import type { SendChatMessagePayload } from "@/features/chat/model/chat.types";

export function createClientCommandId(payload: SendChatMessagePayload, text: string) {
  if (payload.idempotencyKey?.trim()) return payload.idempotencyKey.trim();
  if (payload.voiceSession?.id) return `voice:${payload.voiceSession.id}:parse`;

  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const source = payload.source ?? "text";
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);

  return `${source}:${randomId}:${normalized.length}`;
}
